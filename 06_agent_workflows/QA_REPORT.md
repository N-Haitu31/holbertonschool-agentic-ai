# QA_REPORT.md — Audit de sécurité et de robustesse (Agent QA/DevSecOps)

## 1. Failles détectées, risques et correctifs appliqués (capture réelle de l'agent QA)

> Capture verbatim d'une session Copilot Chat fraîche, persona QA chargée depuis `.github/QA-instructions.md`, exécutée sur les fichiers `Dockerfile`/`docker-compose.yml` remis temporairement dans leur état pré-correctif (commit `1b80ac1`) pour que l'audit soit fait sur du code réellement vulnérable. L'agent a lu le code, `specifications.md`, vérifié l'état Git, appliqué le patch, puis validé son propre travail (`docker compose config`, `node --check`, build, exécution, `docker inspect`) avant de conclure.

**Constat préalable (fausse alerte écartée) :** l'agent a vérifié que `index.js` gérait déjà correctement les cas `tasks.json` absent/illisible/invalide (capture, log, reprise via `setInterval`) — conforme à `specifications.md` — et a donc explicitement choisi de ne pas y toucher : *"Le risque de fichier manquant/invalide est déjà corrigé dans `index.js`; je ne le modifie pas."*

**Faille détectée :** exécution en root, absence de `USER`.
**Risque :** une compromission du processus Node donnerait des privilèges root dans le conteneur.
**Correctif appliqué :** ajout de `USER node` dans `Dockerfile:7`.

**Faille détectée :** capacités Linux, réseau et filesystem non restreints.
**Risque :** possibilités inutiles d'écriture, d'élévation de privilèges et d'exfiltration réseau.
**Correctif appliqué :** dans `docker-compose.yml`, ajout de `network_mode: none`, `read_only`, `cap_drop: ALL`, `no-new-privileges`, montage de `tasks.json` en lecture seule et `tmpfs` sécurisé.

**Contrôles menés par l'agent lui-même avant de conclure :** `docker compose config` (config valide), `node --check index.js` (syntaxe valide), `docker compose build` (build réussi avec `node:22-alpine`), `timeout 2s node index.js` suivi de `test "$?" -eq 124` (processus toujours vivant), puis exécution réelle du conteneur avec `docker inspect`/`docker exec id` confirmant `uid=1000(node)`, réseau désactivé et filesystem en lecture seule.

**Note de cohérence :** le patch généré par cette session live avait laissé `tasks.json` dans la ligne `COPY` du Dockerfile (copie de fichier dans l'image), redondant avec le montage en volume `:ro` déjà présent dans `docker-compose.yml` — un détail que la session QA originale avait corrigé dans un commit séparé (`e095991`, "mount tasks.json as read-only volume instead of baking into image"). Ligne restaurée manuellement pour rester cohérent avec l'historique Git déjà committé ; aucun autre écart constaté (`docker-compose.yml` et `index.js` identiques au commit `e095991`).

## 2. Preuve de non-régression (git diff)

```
$ git diff 1b80ac1 e095991 -- 06_agent_workflows/index.js
(aucune sortie)
```

Aucune ligne de `index.js` modifiée par l'agent QA — la logique métier PO → Dev reste intacte. Seuls les fichiers d'infrastructure ont été touchés :

```
$ git diff --stat 1b80ac1 e095991 -- 06_agent_workflows/
 06_agent_workflows/.dockerignore              | 15 +++++++++++++++
 06_agent_workflows/.github/QA-instructions.md | 22 ++++++++++++++++++++++
 06_agent_workflows/Dockerfile                 |  4 +++-
 06_agent_workflows/docker-compose.yml         | 12 +++++++++++-
 4 files changed, 51 insertions(+), 2 deletions(-)
```

## 3. Vérification runtime des correctifs (exécution réelle)

Conteneur reconstruit à neuf (`docker compose up --build --force-recreate -d`), boucle de 5s observée sur 3 cycles :

```
2026-09-14T21:03:58Z sync_database
2026-09-14T21:04:03Z sync_database
2026-09-14T21:04:08Z sync_database
```

Confirmation des durcissements au runtime (pas seulement déclarés dans le YAML) :

```
$ docker exec task-poller id
uid=1000(node) gid=1000(node) groups=1000(node)

$ docker inspect task-poller --format '{{.HostConfig.NetworkMode}} ReadonlyRootfs={{.HostConfig.ReadonlyRootfs}} CapDrop={{.HostConfig.CapDrop}}'
none  ReadonlyRootfs=true  CapDrop=[ALL]
```

→ process non-root, pas de réseau, filesystem racine en lecture seule, toutes les capacités Linux supprimées : les 4 correctifs sont bien effectifs en conditions réelles, pas juste déclarés dans le YAML.

## 4. Test de résilience — 3 états de `tasks.json`

Rejoué en local (`node index.js`, arrêt forcé après ~1.5s via `timeout` pour observer le comportement, puis restauration du fichier via git) :

| État | Sortie observée | Comportement |
|---|---|---|
| Valide | `sync_database` | Fonctionnement normal |
| Absent | `Unable to read tasks.json: ENOENT: no such file or directory, open 'tasks.json'` | Erreur loggée, process reste vivant (arrêté par `timeout`, pas par un crash) |
| Invalide (JSON corrompu) | `Unable to read tasks.json: Expected double-quoted property name in JSON at position 38` | Erreur loggée, process reste vivant (arrêté par `timeout`, pas par un crash) |

Dans les 3 cas, code de sortie `124` (= tué par `timeout`), jamais un crash spontané : le process aurait continué à boucler indéfiniment, comme prévu par les spécifications, même face à un `tasks.json` manquant ou corrompu.

`tasks.json` a été restauré à son état original après le test (`git diff` vide sur ce fichier).
