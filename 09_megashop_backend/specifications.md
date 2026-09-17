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
