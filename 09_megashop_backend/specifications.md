# Spécifications — Sprint 1 : Le Webhook de Paiement

## User Stories

- En tant que banque partenaire, je veux envoyer une notification de paiement (JSON) à un point d'entrée HTTP dédié, afin que MegaShop-B2B soit informé de l'issue d'une transaction sans attendre de traitement métier de mon côté.
- En tant que système MegaShop-B2B, je veux recevoir cette notification, en conserver une trace immédiate, et accuser réception sans délai, afin de ne jamais faire porter à la banque la latence d'un traitement métier interne.

## Critères d'acceptation

- **Given** une requête `POST` valide sur le point d'entrée du webhook, contenant un corps JSON syntaxiquement correct, **When** le serveur la reçoit, **Then** il enregistre une trace de la notification dans la console et répond immédiatement avec le statut `200 OK`, avant tout traitement métier additionnel.
- **Given** une requête `POST` sur le point d'entrée du webhook dont le corps n'est pas un JSON valide, **When** le serveur la reçoit, **Then** il répond avec un statut d'erreur explicite (`400`) sans planter ni interrompre le service pour les requêtes suivantes.
- **Given** une requête sur une méthode ou une route non prévue (ex : `GET` sur le point d'entrée du webhook), **When** le serveur la reçoit, **Then** il répond avec le comportement par défaut du framework (`404`), sans erreur non gérée.

## Contraintes techniques explicites

- Le serveur doit être écrit en Node.js avec le framework Express.
- Le point d'entrée doit répondre **immédiatement** `200 OK` — aucune attente d'un traitement métier lourd n'est autorisée entre la réception de la requête et l'envoi de la réponse.
- La notification reçue doit être tracée dans la console (stdout).
- L'infrastructure doit être livrée avec un `Dockerfile` minimaliste.

## Ambiguïtés identifiées et résolues

- **Route et méthode exactes** : non précisées dans le besoin métier. Décision : `POST /webhooks/payment`, seule route de ce sprint.
- **Schéma du JSON envoyé par la banque** : non fourni. Décision : le serveur n'impose et ne valide aucun champ métier spécifique (pas de champ obligatoire inventé) ; il accepte tout corps JSON syntaxiquement valide et en trace l'intégralité brute. Toute validation de schéma métier est explicitement hors scope de ce sprint.
- **Contenu exact de la réponse `200 OK`** : non précisé. Décision : statut `200` sans corps de réponse — la banque n'attend qu'un accusé de réception, pas une charge utile.
- **Authentification / vérification de signature du webhook** : non mentionnée dans le besoin métier. Décision : explicitement hors scope de ce sprint, à traiter dans un sprint de sécurisation ultérieur — ne pas l'inventer maintenant.
- **Traitement métier après réception** (mise à jour de commande, notification client, etc.) : non demandé par ce sprint. Décision : hors scope, le webhook se limite à tracer et accuser réception.

## Definition of Done

- Le point d'entrée `POST /webhooks/payment` existe et répond `200 OK` immédiatement sur un corps JSON valide.
- Un corps JSON invalide produit une réponse `400`, sans interrompre le service pour les requêtes suivantes.
- La notification reçue est visible dans les logs console au moment de la requête.
- Chaque critère d'acceptation ci-dessus est couvert par un test automatisé écrit avant son implémentation (TDD).
- Le service démarre et répond correctement dans un conteneur Docker minimaliste.

---

# Spécifications — Sprint 2 : Le Worker Asynchrone

## User Stories

- En tant que système MegaShop-B2B, je veux que l'analyse d'une transaction reçue soit effectuée en dehors du cycle de requête HTTP du webhook, afin que le temps de réponse à la banque ne dépende jamais de la durée d'un traitement métier lourd (analyse de la transaction).
- En tant qu'exploitant de la plateforme, je veux que le service qui reçoit les notifications et le service qui les analyse soient deux processus indépendants communiquant par une file d'attente, afin que la panne ou la lenteur de l'un n'entraîne pas l'indisponibilité de l'autre.

## Critères d'acceptation

- **Given** une notification de paiement valide reçue par le webhook, **When** elle a été tracée en console, **Then** elle est déposée dans une file d'attente partagée avant que le webhook ne réponde `200 OK` — le dépôt en file ne constitue pas un "traitement métier lourd" et ne doit pas retarder perceptiblement la réponse.
- **Given** une notification présente dans la file d'attente, **When** le service Worker la récupère, **Then** il effectue une analyse de la transaction et trace explicitement cet appel dans l'outil d'observabilité de la plateforme.
- **Given** le service de file d'attente n'est pas encore disponible au démarrage des conteneurs, **When** le webhook ou le Worker démarre, **Then** le système ne doit pas échouer de façon définitive : il doit soit réessayer la connexion jusqu'à ce qu'elle réussisse, soit être démarré seulement une fois la file d'attente reconnue comme prête.

## Contraintes techniques explicites

- L'architecture doit comporter trois composants orchestrés ensemble : le service API (webhook, Sprint 1), un service Worker distinct, et un service de file d'attente/cache.
- Le Worker doit fonctionner en boucle continue, sans intervention manuelle, tant que le conteneur est actif.
- L'appel au modèle d'analyse (LLM) effectué par le Worker doit être tracé dans l'outil d'observabilité déjà utilisé sur ce projet (Langfuse), pas seulement journalisé en console.
- Le démarrage du webhook et du Worker doit être résilient à une file d'attente pas encore prête — ce n'est pas une option, c'est une exigence de la Definition of Done de ce sprint.

## Ambiguïtés identifiées et résolues

- **Nature exacte de "l'analyse IA de la transaction"** : le besoin métier ne précise ni le résultat attendu, ni une action automatique consécutive (blocage de commande, alerte, etc.). Décision : pour ce sprint, l'analyse produit uniquement une évaluation textuelle de la transaction, tracée et journalisée — aucune action automatique sur la commande n'est déclenchée. Toute décision métier automatisée à partir de ce résultat est explicitement hors scope, à spécifier dans un sprint ultérieur.
- **Mécanisme technique de la file d'attente** (structure de données Redis utilisée, format exact des messages) : ce n'est pas au Product Owner d'en décider — relève entièrement du Développeur, à condition que la notification déposée par le webhook soit bien celle traitée par le Worker, sans perte ni duplication dans le fonctionnement normal.
- **Mécanisme de résilience au démarrage** (retry applicatif vs. `healthcheck` + `depends_on`) : non tranché ici non plus, choix technique laissé au Développeur/QA — seule la contrainte de résultat (pas d'échec définitif si la file d'attente n'est pas encore prête) est imposée.
- **Persistance des résultats d'analyse** (base de données, historique consultable) : non demandée par ce sprint. Décision : hors scope, le résultat de l'analyse est uniquement journalisé/tracé, pas stocké durablement pour l'instant.

## Definition of Done

- Le webhook dépose chaque notification valide dans la file d'attente avant de répondre `200 OK`, sans dépendre du traitement du Worker pour répondre.
- Le Worker consomme les notifications de la file d'attente en continu et déclenche une analyse IA pour chacune.
- Chaque appel au LLM effectué par le Worker apparaît comme une trace dans Langfuse.
- Le webhook et le Worker démarrent et restent opérationnels même si la file d'attente n'est pas immédiatement disponible au lancement des conteneurs.
- Chaque critère d'acceptation ci-dessus est couvert par un test automatisé écrit avant son implémentation (TDD), dans la mesure où le comportement est testable sans dépendre d'un vrai appel LLM facturé.

---

# Spécifications — Sprint 3 : Le Garde-Fou (HITL & Audit)

_Section rédigée après implémentation (l'énoncé du Sprint 3 ne prévoyait pas d'étape PO)._

## User Stories

- En tant que responsable financier, je veux qu'aucun statut "Remboursé" ne soit appliqué à une commande sans mon accord explicite, afin d'éviter un remboursement erroné ou frauduleux.
- En tant qu'auditeur, je veux retrouver, pour chaque demande de remboursement, l'analyse qui l'a précédée et la décision humaine prise, afin de pouvoir justifier après coup chaque remboursement accordé ou refusé.

## Critères d'acceptation

- **Given** une notification de remboursement traitée par le Worker, **When** l'analyse de la transaction est terminée, **Then** le traitement est suspendu et une confirmation humaine (`o`/`n`) est demandée avant tout changement de statut.
- **Given** une confirmation `o`, **When** l'opérateur valide, **Then** le statut "Remboursé" est appliqué et la décision est enregistrée comme un succès.
- **Given** une réponse `n`, **When** l'opérateur refuse, **Then** l'action est annulée, aucun statut n'est modifié et la décision est enregistrée comme un échec.
- **Given** une notification qui n'est pas un remboursement, **When** le Worker la traite, **Then** elle est traitée sans aucune demande de confirmation.
- **Given** une décision humaine enregistrée, **When** on consulte l'outil d'observabilité, **Then** elle est rattachée à la trace de l'analyse de cette même transaction.

## Contraintes techniques explicites

- La confirmation est saisie depuis un terminal interactif.
- Si le Worker s'exécute sous Docker, le conteneur doit permettre cette saisie.
- La décision est enregistrée dans l'outil d'observabilité déjà utilisé (Langfuse) : succès pour une action autorisée, échec pour une action refusée.

## Ambiguïtés identifiées et résolues

- **Reconnaître un remboursement** : non précisé. Décision : une notification est un remboursement quand son champ `status` vaut `refund` ; aucun nouveau champ n'est introduit.
- **Réponse autre que `o` ou `n`** : non précisé. Décision : par prudence, toute réponse différente de `o` (casse et espaces ignorés) annule l'action.
- **Ce que signifie "appliquer le statut"** : aucune base de données n'existe à ce stade (la persistance est hors scope depuis le Sprint 2). Décision : l'application du statut est tracée en console, pas stockée durablement.
- **Ordre analyse / confirmation** : l'analyse IA s'exécute toujours en premier et informe l'opérateur ; elle ne décide jamais à sa place.
- **Hors scope, assumé** : délai maximal d'attente d'une réponse, et traitement en parallèle. (L'identification de l'opérateur, d'abord hors scope, a été ajoutée ensuite : voir le complément « Traçabilité de l'opérateur ».) Le Worker étant séquentiel, les notifications suivantes attendent en file pendant qu'une confirmation est en cours.

## Definition of Done

- Un remboursement suspend le Worker jusqu'à une réponse humaine ; une notification ordinaire n'est jamais bloquée.
- `o` applique le statut et enregistre un score de succès ; `n` annule et enregistre un score d'échec, chacun rattaché à la trace de l'analyse.
- La saisie fonctionne dans un conteneur Docker.
- Chaque critère est couvert par un test automatisé écrit avant l'implémentation (TDD), dans la mesure où il est testable sans appel LLM facturé ni terminal réel ; le prompt interactif et le score Langfuse réels sont vérifiés manuellement (voir `PROOF.md`).

## Complément Sprint 3 : Garde-fou budgétaire FinOps

_Ajouté après relecture de la consigne globale du projet, qui demande des appels LLM « tracés, budgétés et évalués » (l'énoncé du Sprint 3 ne le demandait pas explicitement)._

### User Story

- En tant que responsable FinOps, je veux être alerté quand un appel LLM ou le cumul des appels dépasse un budget défini, afin de détecter une dérive de coût pendant l'exécution et pas seulement après coup.

### Critères d'acceptation

- **Given** une analyse dont la consommation reste sous les limites, **When** le Worker la termine, **Then** aucune alerte n'est émise et un score de succès est enregistré sur la trace de cette analyse.
- **Given** une analyse dont la consommation dépasse la limite par appel, **When** le Worker la termine, **Then** une alerte FinOps est émise et un score d'échec est enregistré sur la même trace.
- **Given** des analyses successives dont le cumul dépasse le budget total, **When** le budget est franchi, **Then** l'analyse qui le franchit déclenche l'alerte et le score d'échec.
- **Given** un seuil absent ou invalide dans la configuration, **When** le Worker démarre, **Then** une valeur par défaut sûre est utilisée (jamais un budget nul qui alerterait en permanence).

### Ambiguïtés identifiées et résolues

- **Unité du budget** : le coût en dollars est calculé côté Langfuse, pas dans l'application. Décision : le budget est exprimé en **tokens** (`total_tokens` renvoyé par le fournisseur), sans tarif inventé dans le code.
- **Valeurs par défaut** : 1 500 tokens par appel et 20 000 tokens cumulés par exécution du Worker, choisis à partir des mesures de `FINOPS_REVIEW.md` (analyses réelles entre 620 et 946 tokens). Un seuil de 150 tokens, comme au projet `07_langfuse`, alerterait à chaque appel.
- **Effet d'un dépassement** : alerte et score uniquement, sans bloquer le traitement (comme un Post-Hook) ; le remboursement reste soumis à la validation humaine.
- **Portée du cumul** : il repart de zéro à chaque démarrage du Worker (pas de persistance, hors scope).
- **Configuration** : variables d'environnement `FINOPS_MAX_TOKENS_PER_CALL` et `FINOPS_TOKEN_BUDGET`.

## Complément Sprint 3 : Traçabilité de l'opérateur

_Ajouté après relecture du concept « Le Nouveau Rôle du Lead Engineer », qui fait du Lead « l'arbitre » qui « porte la responsabilité finale » des décisions critiques._

### User Story

- En tant qu'auditeur, je veux savoir **qui** a autorisé ou refusé chaque remboursement, afin que la décision puisse être attribuée à une personne responsable et pas seulement à un « humain » anonyme.

### Critères d'acceptation

- **Given** une décision humaine (autorisée ou refusée) sur un remboursement, **When** elle est enregistrée dans l'outil d'observabilité, **Then** le commentaire de la décision indique l'opérateur qui l'a prise.
- **Given** aucune identité d'opérateur configurée, **When** une décision est enregistrée, **Then** elle porte la mention explicite « non-identifié » : le système n'invente jamais une identité.
- **Given** une décision, **When** elle est tracée en console, **Then** l'opérateur y figure aussi.

### Ambiguïtés identifiées et résolues

- **Source de l'identité** : variable d'environnement `OPERATOR_NAME`. Le nom d'utilisateur du système n'est **pas** utilisé : dans le conteneur il vaut toujours `node`, ce qui attribuerait faussement la décision à un compte technique.
- **Fiabilité** : l'identité est **déclarative** (l'opérateur indique son nom dans la configuration), elle n'est pas authentifiée. Une authentification réelle de l'opérateur reste hors scope.
