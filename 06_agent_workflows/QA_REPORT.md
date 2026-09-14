# QA_REPORT.md — Audit de sécurité et de robustesse (Agent QA/DevSecOps)

## 0. Prompt utilisé

Prompt exact imposé par l'énoncé de la Task 2, envoyé tel quel dans une session Copilot Chat fraîche après relecture forcée de `.github/QA-instructions.md` :

```
Audite l'intégralité de mon projet actuel en respectant scrupuleusement tes instructions de persona. Détecte les failles de sécurité, corrige le code, et applique directement les patchs architecturaux nécessaires via tes outils d'édition.
```

Envoyé sur les fichiers `Dockerfile`/`docker-compose.yml` remis temporairement dans leur état pré-correctif (commit `1b80ac1`) pour que l'audit porte sur du code réellement vulnérable.

## 1. Capture verbatim de la réponse de l'agent QA

**Constat initial (fausse alerte écartée) :** *"Le point de vigilance explicitement demandé dans les consignes QA est la gestion de `tasks.json` absent, illisible ou invalide. Le fichier `index.js` est déjà conforme sur ce point : il attrape les erreurs de lecture/parse JSON, logge un message, et continue indéfiniment en bouclant toutes les 5 secondes selon les spécifications. Je n'ai donc pas altéré la logique métier de l'application."*

**Faille détectée :** absence de confinement du conteneur — exécution en root, pas de `USER`, aucun durcissement réseau/capacités/filesystem.
**Risque :** *"Une compromission du processus Node donnerait un accès root dans le conteneur. Sans restriction réseau et sans suppression des capacités Linux, un attaquant ou un code malveillant peut exploiter des privilèges inutiles, écrire dans le système de fichiers de la racine ou exfiltrer des données via le réseau."*
**Correctif appliqué (tel que rapporté par l'agent) :** `USER node`, `read_only: true`, `tmpfs` sur `/tmp`, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, `network_mode: none`, montage de `tasks.json` en lecture seule.

**Choix explicite signalé par l'agent :** *"j'ai choisi de ne pas modifier `index.js`, car la gestion réelle des erreurs sur `tasks.json` est déjà conforme aux spécifications et ne constitue pas un bug fonctionnel à corriger."*

**Contrôles menés par l'agent lui-même avant de conclure :** `docker compose config`, `node --check index.js`, `docker compose build`, `docker compose up --build --force-recreate -d`, `docker logs` (sortie `sync_database` répétée), `docker inspect` (user/network/readonly/capdrop), `docker exec ... id` (uid=1000 confirmé).

## 2. Note de cohérence avec le code committé

Cette session live (comme la précédente rejouée avec un prompt différent) a reproduit les 4 mêmes failles et correctifs de fond, mais avec deux variations mineures par rapport à la version déjà committée (`e095991`) :
- `tmpfs: [/tmp]` sans les options `noexec,nosuid,nodev` (version committée plus stricte : `/tmp:rw,noexec,nosuid,nodev`) ;
- `COPY index.js tasks.json ./` dans le Dockerfile (redondant avec le montage volume `:ro`), plus un `RUN chown -R node:node /app` et `user: "1000:1000"`/`init: true` additionnels non présents dans la version committée.

Aucune de ces variations n'est une régression de sécurité *par rapport à l'énoncé* (juste moins strict que ce qu'on avait déjà), mais pour rester cohérent avec le code déjà audité et re-vérifié dans ce rapport, `Dockerfile` et `docker-compose.yml` ont été restaurés à la version committée (`e095991`) après capture de cette réponse. `index.js` n'a été modifié par aucune des deux sessions.

## 3. Preuve de non-régression (git diff)

```
$ git diff 1b80ac1 e095991 -- 06_agent_workflows/index.js
(aucune sortie)
```

Aucune ligne de `index.js` modifiée par l'agent QA, confirmé indépendamment par deux sessions live séparées. Seuls les fichiers d'infrastructure ont été touchés :

```
$ git diff --stat 1b80ac1 e095991 -- 06_agent_workflows/
 06_agent_workflows/.dockerignore              | 15 +++++++++++++++
 06_agent_workflows/.github/QA-instructions.md | 22 ++++++++++++++++++++++
 06_agent_workflows/Dockerfile                 |  4 +++-
 06_agent_workflows/docker-compose.yml         | 12 +++++++++++-
 4 files changed, 51 insertions(+), 2 deletions(-)
```

## 4. Vérification runtime des correctifs (exécution réelle, sur le code final committé)

Conteneur reconstruit à neuf (`docker compose up --build --force-recreate -d`), boucle de 5s observée sur 3 cycles :

```
2026-09-14T21:37:21Z sync_database
2026-09-14T21:37:26Z sync_database
2026-09-14T21:37:31Z sync_database
```

Confirmation des durcissements au runtime (pas seulement déclarés dans le YAML) :

```
$ docker exec task-poller id
uid=1000(node) gid=1000(node) groups=1000(node)

$ docker inspect task-poller --format '{{.HostConfig.NetworkMode}} ReadonlyRootfs={{.HostConfig.ReadonlyRootfs}} CapDrop={{.HostConfig.CapDrop}}'
none  ReadonlyRootfs=true  CapDrop=[ALL]
```

→ process non-root, pas de réseau, filesystem racine en lecture seule, toutes les capacités Linux supprimées : les correctifs sont bien effectifs en conditions réelles, pas juste déclarés dans le YAML.

## 5. Test de résilience — dans le conteneur réel (invalide + illisible)

L'énoncé demande explicitement de vérifier que le script gère "un `tasks.json` temporairement illisible ou invalide sans faire crasher définitivement **le conteneur**". Testé directement sur le conteneur `task-poller` en cours d'exécution (`docker compose up`), en modifiant `tasks.json` sur l'hôte pendant que le conteneur tourne (bind-mount `:ro`), sans jamais le redémarrer :

| Étape | Action sur l'hôte | Sortie du conteneur | Statut du conteneur |
|---|---|---|---|
| Baseline | `tasks.json` valide | `sync_database` | `Up` |
| JSON invalide | écriture en place d'un JSON malformé | `Unable to read tasks.json: Expected property name or '}' in JSON at position 2` | `Up` (inchangé) |
| Fichier illisible | `chmod 000 tasks.json` (contenu valide, permissions retirées) | `Unable to read tasks.json: EACCES: permission denied, open 'tasks.json'` | `Up` (inchangé) |
| Restauration | `chmod 644` + contenu valide réécrit en place | `sync_database` reprend | `Up` (inchangé, jamais redémarré) |

Le conteneur est resté à l'état `Up` en continu sur toute la durée du test (29 secondes, aucun redémarrage, aucun arrêt) — la boucle survit aux deux scénarios demandés par l'énoncé et reprend normalement dès que `tasks.json` redevient valide et lisible.

**Note technique (subtilité Linux/Docker rencontrée pendant le test) :** une restauration via `mv` (remplacement de fichier) n'est **pas** vue par le conteneur — un bind-mount Docker sur un fichier unique reste attaché à l'inode d'origine, et `mv` en crée un nouveau à ce chemin. Seule une écriture *en place* (troncature du fichier existant, même inode — ce que fait `printf >`, `cat >` sur un fichier déjà existant, ou un éditeur qui sauvegarde par écrasement) est répercutée dans le conteneur sans redémarrage. Point pertinent pour une vraie procédure d'exploitation : mettre à jour `tasks.json` en production doit se faire par écriture en place, pas par remplacement atomique du fichier, sous peine de ne jamais voir le changement pris en compte par le conteneur en cours d'exécution.

`tasks.json` a été restauré à son état et ses permissions d'origine après le test (`git diff` vide sur ce fichier).

### Complément — test local à 3 états (valide / absent / invalide)

Rejoué également en local (`node index.js`, hors conteneur), pour couvrir en plus le cas "fichier absent" (non explicitement demandé par l'énoncé de la Task 2, mais couvert par la gestion d'erreur générique du code) :

| État | Sortie observée | Comportement |
|---|---|---|
| Valide | `sync_database` | Fonctionnement normal |
| Absent | `Unable to read tasks.json: ENOENT: no such file or directory, open 'tasks.json'` | Erreur loggée, process reste vivant (arrêté par `timeout`, pas par un crash) |
| Invalide (JSON corrompu) | `Unable to read tasks.json: Expected double-quoted property name in JSON at position 38` | Erreur loggée, process reste vivant (arrêté par `timeout`, pas par un crash) |
