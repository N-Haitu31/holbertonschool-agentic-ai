# QA Report — Sprint 1 : Le Webhook de Paiement

Audit de sécurité et de robustesse mené sur `server.js`, `Dockerfile` et
`package.json`, conformément à `.github/QA-instructions.md`.

## Faille 1 — Conteneur exécuté avec les privilèges root

- **Faille détectée** : le `Dockerfile` initial ne contenait aucune directive `USER`. Vérifié en construisant l'image et en exécutant `id` dedans : `uid=0(root) gid=0(root)`.
- **Risque** : si le processus Node.js est compromis (ex : faille dans une dépendance ou dans le code applicatif), l'attaquant hérite immédiatement des privilèges root à l'intérieur du conteneur, ce qui élargit considérablement la surface d'exploitation (accès en écriture à tout le système de fichiers du conteneur, plus grande probabilité d'évasion de conteneur en cas de faille noyau).
- **Correctif appliqué** : ajout de `USER node` dans le `Dockerfile`, juste après la copie des fichiers applicatifs et avant `CMD`. L'image `node:22-alpine` fournit nativement un utilisateur non privilégié `node` (uid 1000), aucune création d'utilisateur supplémentaire n'était nécessaire.

**Preuve** : reconstruction de l'image après patch, `docker run --rm <image> id` renvoie désormais `uid=1000(node) gid=1000(node)`.

## Vérifications complémentaires (aucune faille supplémentaire trouvée)

- **Dépendances** : `package.json` ne déclare qu'une seule dépendance, `express`, fixée en version exacte (`5.2.1`, pas de `^`/`~`). `npm audit --omit=dev` : 0 vulnérabilité connue.
- **Image de base** : `node:22-alpine` déjà utilisée (variante allégée) — pas de correctif nécessaire sur ce point.
- **Gestion d'erreur sur entrée invalide** : un corps JSON malformé est intercepté par le middleware d'erreur dédié (`entity.parse.failed` / `SyntaxError`) et renvoie `400`, sans crash du process — vérifié par le test `POST /webhooks/payment with invalid JSON returns 400, service stays up`, qui enchaîne une requête valide juste après pour prouver que le service reste opérationnel.
- **Secrets** : aucune clé, credential ou secret en dur dans le code versionné.
- **Respect du TDD** : les 4 critères d'acceptation de `specifications.md` sont chacun couverts par un test dans `tests/payment-webhook.test.js`, écrit avant l'implémentation de `server.js` (cycle Red confirmé : `npm test` échouait avec `MODULE_NOT_FOUND` avant l'écriture de `server.js`, puis passait au vert une fois le code minimal ajouté).

## Non-régression

Aucune modification n'a porté sur `server.js` ni sur la logique métier — seul le `Dockerfile` a été modifié (ajout de `USER node`). Le Dev et le patch QA de ce sprint ont été committés en un seul commit (`b8f2c00`, pas de commit intermédiaire avant/après le patch), donc un `git diff` entre deux états internes au Sprint 1 n'existe pas. Preuve réelle disponible à la place : pendant la phase d'audit, le seul outil d'édition utilisé a ciblé `Dockerfile` — ni `server.js` ni `tests/payment-webhook.test.js` n'ont été ouverts ou modifiés durant cette phase.

## Vérification runtime finale

Conteneur reconstruit avec le correctif, lancé avec `-p 3999:3000`, puis requête réelle :

```
$ curl -X POST http://localhost:3999/webhooks/payment -H "Content-Type: application/json" -d '{"transactionId":"tx_qa"}'
→ 200

$ docker logs <container>
[payment-webhook] listening on port 3000
[payment-webhook] notification received: {"transactionId":"tx_qa"}
```

Comportement fonctionnel identique à avant le patch, désormais exécuté en non-root.

---

# Sprint 2 — Le Worker Asynchrone

## Faille 2 — Aucune résilience si Redis n'est pas disponible au démarrage

- **Faille détectée** : la première version de `server.js`/`worker.js` faisait `createClient(...).connect()` une seule fois, sans gestion d'échec. Reproduit en réel en pointant `REDIS_URL` vers un port sans rien derrière :
  ```
  $ REDIS_URL=redis://127.0.0.1:59999 node server.js
  ConnectionTimeoutError: Connection timeout
  ...
  Node.js v20.20.2
  $ echo $?
  1
  ```
  Le process crashe (rejet de promesse non intercepté) après le timeout de connexion (~5s), sans aucune tentative de reconnexion.

- **Risque** : dans un environnement Docker Compose réel, l'ordre de démarrage des conteneurs n'implique pas que le service interne de Redis soit déjà prêt à accepter des connexions (un simple `depends_on: - redis` en liste n'attend que le démarrage du conteneur, pas la disponibilité du serveur Redis dedans). N'importe quel démarrage un peu lent (image froide, disque chargé, ou un simple redémarrage de Redis en production) provoque un crash définitif de l'App et du Worker, sans redémarrage automatique ni alerte claire — panne totale de la réception et du traitement des paiements.

- **Correctif appliqué** : deux mécanismes complémentaires, volontairement redondants ("belt-and-suspenders") car ils couvrent des cas différents :

  1. **Retry applicatif** (`queue.js`, fonction `connectQueueWithRetry`) : recrée un nouveau client Redis à chaque tentative (un client dont le `connect()` a échoué renvoie `Socket already opened` si on le réutilise tel quel — vérifié en réel), avec un délai fixe de 2 secondes entre chaque essai, retenté indéfiniment, chaque échec étant journalisé. Ce mécanisme protège aussi contre une coupure Redis **après** le démarrage (ex : redémarrage de Redis en production), un cas que `depends_on` ne couvre jamais puisqu'il ne s'applique qu'au lancement des conteneurs.
  2. **Healthcheck Redis + `depends_on: condition: service_healthy`** (`docker-compose.yml`) : le service `redis` expose un healthcheck (`redis-cli ping`), et `app`/`worker` déclarent `depends_on: redis: condition: service_healthy` — Docker Compose ne démarre plus ces deux services tant que Redis n'a pas répondu positivement à son ping. Ceci évite l'essentiel des cas de course au démarrage dans le contexte normal d'un `docker compose up`.

- **Preuve — reconnexion automatique sans intervention manuelle** : conteneur `app` démarré volontairement en contournant `depends_on` (`docker compose up -d --no-deps app`), Redis totalement arrêté :
  ```
  $ docker compose ps app
  09_megashop_backend-app-1   Up 13 seconds
  $ docker compose logs app
  [queue] connection to Redis failed (getaddrinfo ENOTFOUND redis), retrying in 2000ms...
  [queue] connection to Redis failed (getaddrinfo ENOTFOUND redis), retrying in 2000ms...
  ... (répété toutes les 2s, conteneur toujours "Up", pas de crash)
  ```
  Puis démarrage de Redis sans toucher au conteneur `app` :
  ```
  $ docker compose up -d redis
  $ docker compose logs app
  ... (dernières tentatives échouées)
  [payment-webhook] listening on port 3000
  $ curl -X POST http://localhost:3000/webhooks/payment -d '{"transactionId":"tx_e2e_02"}'
  webhook still works: 200
  ```
  L'App s'est reconnectée et a servi une requête sans redémarrage manuel du conteneur.

## Vérification bout-en-bout du pipeline asynchrone

Stack complète démarrée avec `docker compose up --build -d` (healthcheck + `condition: service_healthy` en place) :
```
Container redis-1  Healthy
Container app-1     Started   (après redis Healthy)
Container worker-1  Started   (après redis Healthy)
```
Notification réelle envoyée :
```
$ curl -X POST http://localhost:3000/webhooks/payment -d '{"transactionId":"tx_e2e_01","amount":1200,"currency":"EUR"}'
→ 200
```
Logs du Worker :
```
[worker] processing transaction: { transactionId: 'tx_e2e_01', amount: 1200, currency: 'EUR' }
[worker] AI analysis: Cette notification est **suspecte** car l'identifiant de transaction (tx_e2e_01) évoque un test de bout en bout...
```
Trace confirmée côté Langfuse via l'API publique (`GET /api/public/traces`) : un nouvel enregistrement `OpenAI.chat` apparaît avec l'horodatage exact de l'appel, prouvant que `observeOpenAI` a bien exporté la trace du Worker.

## Vérification complémentaire (Sprint 2)

- **Dépendances** : `redis` (6.2.1), `openai` (4.104.0), `langfuse` (3.38.20), `dotenv` (16.6.1) — toutes en version exacte, pas de `^`/`~`. `npm audit --omit=dev` : 0 vulnérabilité.
- **Image Docker** : le premier build de la Task 2 échouait au runtime (`Cannot find module './queue.js'` / `worker.js`) car le `Dockerfile` du Sprint 1 ne copiait que `server.js`. Corrigé en copiant explicitement `server.js worker.js queue.js`. Ce n'est pas une faille de sécurité mais un défaut fonctionnel bloquant, corrigé avant l'audit de résilience proprement dit (un correctif de sécurité n'a de sens que sur un service qui démarre).
- **Non-régression** : suite de tests Sprint 1 relancée après le refactor de la connexion Redis (`connectQueueWithRetry`) — 6/6 toujours verts, aucun changement de comportement métier.
- **Diff réel entre Sprint 1 et Sprint 2** (`git diff b8f2c00 679b0ca -- server.js`, commits réels du repo) confirme que le refactor est scopé exactement à l'attendu — passage à une factory `createApp(queueClient)`, ajout de `queueClient.lPush(...)` dans le handler, aucun changement de la logique de réponse `200`/`400` elle-même (le middleware d'erreur JSON est déplacé dans la factory mais son contenu est identique) :
  ```diff
  -const app = express();
  -app.use(express.json());
  +const QUEUE_KEY = 'payment-notifications';
  +
  +function createApp(queueClient) {
  +  const app = express();
  +  app.use(express.json());

  -app.post('/webhooks/payment', (req, res) => {
  -  console.log('[payment-webhook] notification received:', JSON.stringify(req.body));
  -  res.sendStatus(200);
  -});
  +  app.post('/webhooks/payment', async (req, res) => {
  +    console.log('[payment-webhook] notification received:', JSON.stringify(req.body));
  +    await queueClient.lPush(QUEUE_KEY, JSON.stringify(req.body));
  +    res.sendStatus(200);
  +  });
  ```
- **Privilèges du conteneur `worker`** : la Faille 1 (Sprint 1) n'avait été vérifiée que sur le conteneur `app`. Revérifié explicitement sur `worker`, qui partage la même image (`Dockerfile` avec `USER node`) :
  ```
  $ docker compose exec worker id
  uid=1000(node) gid=1000(node) groups=1000(node),1000(node)
  ```

---

# Affinage des System Prompts (fin de projet)

Les personas de la Task 0 n'avaient pas été modifiés depuis, alors que
plusieurs erreurs réelles sont survenues en cours de projet. Chacune a été
reportée dans l'instruction du rôle concerné (`.github/DEV-instructions.md`,
`.github/QA-instructions.md`), après coup :

| Erreur constatée | Rôle | Règle ajoutée |
|---|---|---|
| Le `Dockerfile` ne copiait que `server.js` : `Cannot find module './queue.js'` au démarrage du conteneur | Dev | Image Docker complète, à construire et démarrer réellement avant de conclure |
| `{ stdin as input }` (syntaxe `import`) dans un fichier CommonJS : `SyntaxError` | Dev | Ne pas mélanger CommonJS et ESM, y compris en s'inspirant d'un exemple de l'autre système |
| `npm install` oublié après ajout de dépendances : `Cannot find module 'dotenv'` en local | Dev | `npm install` après toute modification de `package.json` |
| Crash au démarrage si Redis n'est pas prêt (`ConnectionTimeoutError`) | QA | Catégorie explicite « dépendances de démarrage et connexions asynchrones », à tester réellement, avec retry ou `healthcheck` + `depends_on` |
| Image incomplète non détectée à l'audit | QA | Catégorie « complétude de l'image » |
| Aucun budget sur les appels LLM avant la consigne globale | QA | Catégorie « coût et budget (FinOps) » |
| Leçon du Projet 6 : une clause d'audit ouverte manque des catégories non citées | QA | Interdiction de conclure « rien à signaler » sans avoir parcouru chaque catégorie |

Choix conservé du Projet 6 : le Dev ne reçoit **pas** la liste des failles de
sécurité à éviter (root, résilience), pour que l'audit QA reste un vrai
contrôle indépendant ; seules les erreurs **fonctionnelles** lui sont
reportées.

---

# Revue du Lead Engineer

Le concept « Le Nouveau Rôle du Lead Engineer » attribue trois
responsabilités au Lead. Voici comment le projet y répond, et ce qui reste
ouvert.

## 1. Gardien du SSOT

- Une spécification par sprint dans `specifications.md`, avec les
  ambiguïtés tranchées et une Definition of Done.
- Quand l'IA s'est trompée, la correction ne s'est pas limitée au code :
  chaque erreur a été reportée dans l'instruction du rôle concerné (section
  « Affinage des System Prompts » ci-dessus).
- **Limite assumée** : trois compléments de spécification (Sprint 3,
  budget FinOps, traçabilité de l'opérateur) ont été rédigés **après**
  l'implémentation, et l'indiquent. Le Sprint 3 n'avait pas d'étape PO dans
  l'énoncé ; les deux autres viennent de la relecture de la consigne globale
  et du concept du Lead.

## 2. FinOps et télémétrie

- Chaque appel LLM est tracé dans Langfuse, avec un coût, et un garde-fou
  budgétaire alerte et note chaque analyse (`finops_budget`).
- Revue de clôture dans `FINOPS_REVIEW.md`, dont une erreur de conclusion
  (seuil de tokens jugé jamais dépassé) a été corrigée après vérification
  des tokens réels.
- **Non couvert : la dérive du modèle (*model drift*).** Le projet ne
  compare pas la consommation ou la qualité d'un même prompt dans le temps :
  toutes les mesures tiennent sur quelques jours avec un seul modèle
  (`gemini-3.6-flash`). Suivre la dérive demanderait un jeu de prompts de
  référence rejoué régulièrement.
- **Limites du budget** : il est exprimé en tokens, il repart de zéro à
  chaque démarrage du Worker, et le coût affiché par Langfuse est peut-être
  sous-estimé (tokens de raisonnement non comptés).

## 3. Juge du Human-in-the-Loop

- Pre-Hook sur les remboursements : le Worker est suspendu tant qu'un
  humain n'a pas répondu, et toute réponse autre que `o` annule l'action.
- La décision est scorée sur la trace de l'analyse, avec le nom de
  l'opérateur (`OPERATOR_NAME`).
- **Limites assumées** :
  - l'identité de l'opérateur est **déclarative, pas authentifiée** : n'importe qui
    peut écrire n'importe quel nom dans sa configuration ;
  - un seul Worker séquentiel, sans délai maximal d'attente : une
    confirmation en attente bloque les notifications suivantes ;
  - il n'y a **pas de base de données** : l'application du statut
    « Remboursé » est simulée par un message console, donc rien n'est
    réellement modifié ni persisté.
- **Conformité (RGPD, PCI-DSS) : non traitée par le code.** Le corps
  complet de chaque notification est journalisé en console par le webhook
  et envoyé tel quel au fournisseur du LLM (Gemini) et à Langfuse Cloud.
  Les données de ce projet sont fictives ; en production, des données de
  carte ne devraient jamais quitter le périmètre conforme (PCI-DSS) et des
  données personnelles exigeraient une base légale et un accord avec chaque
  sous-traitant (RGPD). Il faudrait ajouter une étape de masquage avant
  l'appel LLM et avant la trace.
