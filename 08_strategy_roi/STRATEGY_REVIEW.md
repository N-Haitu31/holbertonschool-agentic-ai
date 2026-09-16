# Synthèse Stratégique — Plateforme E-commerce

## 1. ROI mesuré (Task 0)

Sur les trois tâches chiffrées (authentification, migration BDD, refactoring legacy), le passage à un workflow assisté par IA fait tomber le coût total de **4 800 € à 989,50 €**, soit une économie de **3 810,50 € (-79 %)**. Le coût des tokens reste marginal face au temps humain économisé : le ratio économie/coût-tokens va de **53x sur la tâche la moins rentable** (migration BDD) à **559x sur la plus rentable** (authentification). Même dans le pire cas mesuré, l'investissement en licences/API est donc couvert plusieurs dizaines de fois par la seule économie de temps dev.

## 2. Architecture retenue (Task 1)

Trois décisions structurantes répondent aux trois contraintes métier (panier <50ms + résilience, logs inaltérables, API bancaire lente) :

- **Redis en hot-path pour le panier**, avec Postgres comme source de vérité en arrière-plan — pour tenir le <50ms sans sacrifier la durabilité des données.
- **Audit en flux append-only**, avec stockage WORM et hachage — pour garantir l'inaltérabilité légale des logs sans dépendre d'un contrôle applicatif qu'on pourrait un jour contourner par erreur.
- **Paiement découplé via une file asynchrone** — pour isoler la latence de ~4s de l'API bancaire du parcours utilisateur.

## 3. Un choix IA que j'ai conservé

La file asynchrone pour le paiement bancaire. C'est le bon arbitrage : une intégration synchrone aurait fait porter les 4 secondes de latence de l'API bancaire directement sur l'utilisateur, ce qui est incompatible avec l'exigence de panier ultra-rapide. En découplant l'appel bancaire du flux principal, l'architecture isole une dépendance externe lente sans la laisser dégrader l'expérience critique. L'alternative synchrone a été correctement écartée plutôt que proposée par défaut — c'est exactement le type de compromis justifié, pas générique, que j'attendais du persona d'architecte.

## 4. Un choix IA que j'ai corrigé

Dans le diagramme Mermaid initial, la flèche Redis → Cart portait le label *"fallback si DB principale indisponible"*. En relisant l'ADR en parallèle, j'ai constaté une incohérence : l'ADR décrit Redis comme le **chemin principal** du panier (c'est lui qui absorbe le <50ms), Postgres n'intervenant qu'en source de vérité de secours — pas l'inverse. Le label du diagramme inversait donc le rôle réel des deux systèmes. Je l'ai corrigé pour refléter fidèlement l'ADR. C'est un rappel utile : un diagramme généré par IA peut être visuellement cohérent tout en contredisant sa propre justification écrite si personne ne les confronte l'un à l'autre.

## 5. Compromis assumés

- **Coût** : plus élevé qu'une architecture mono-stockage — trois systèmes à opérer (Redis, Postgres, stockage WORM) au lieu d'un seul.
- **Complexité** : la cohérence entre Redis et Postgres n'est pas un problème résolu mais un risque explicitement noté dans l'ADR (eventual consistency) — elle demande une stratégie de réconciliation assumée, pas improvisée en production.
- **Performance / résilience** : nettement meilleures que l'alternative simple (BDD unique) — le panier reste utilisable même si Postgres tombe, ce qui répond directement à la contrainte de résilience.
- **Sécurité** : non traitée par cette itération de l'architecture. Le diagramme et l'ADR couvrent la disponibilité et l'intégrité des logs, pas la sécurité réseau (segmentation, chiffrement en transit entre services, gestion des accès) — c'est un angle mort à combler avant mise en production.

## 6. Recommandation

Je recommanderais cette architecture à une entreprise, mais sous condition : uniquement si l'équipe qui l'opère est capable de gérer activement la stratégie d'eventual consistency entre Redis et Postgres mentionnée dans l'ADR — sans quoi le gain de performance sur le panier se paiera en incidents de données silencieux. Je ne la recommanderais pas telle quelle à une équipe sans compétence dédiée sur ce point, ni sans qu'un volet sécurité réseau vienne compléter l'ADR avant tout déploiement en production.
