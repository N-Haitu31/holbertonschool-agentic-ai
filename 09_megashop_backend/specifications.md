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
