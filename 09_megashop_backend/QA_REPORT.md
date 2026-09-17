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

Aucune modification n'a porté sur `server.js` ni sur la logique métier — seul le `Dockerfile` a été modifié (ajout de `USER node`). Preuve :

```
$ git diff --stat -- server.js tests/
(aucune sortie — fichiers inchangés depuis le commit du Sprint 1)
```

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
