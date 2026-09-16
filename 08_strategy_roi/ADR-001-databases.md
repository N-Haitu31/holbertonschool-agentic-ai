# ADR-001 — Choix de stockage pour le panier, l'audit et le paiement

- Statut : Accepté
- Date : 2026-09-16

## Contexte

Le projet MegaShop-B2B doit répondre à trois contraintes bien identifiées :

1. Le panier doit être extrêmement rapide, avec une latence cible < 50 ms, et rester disponible si la base de données principale est temporairement indisponible.
2. L'historique complet des actions doit être conservé dans un journal d'audit inaltérable à des fins légales.
3. Le paiement repose sur une API bancaire externe très lente (environ 4 s de réponse moyenne), ce qui impose une exécution non bloquante pour le parcours utilisateur.

Le contexte ne donne pas d'informations détaillées sur le nombre de produits, la région de déploiement, les exigences réglementaires précises au-delà de l'inaltérabilité des logs, ni sur les contraintes de conformité bancaire. Nous ne supposons donc aucun paramètre supplémentaire non explicitement nécessaire à la conception.

## Décision

Nous retenons une architecture de données en couches, avec des responsabilités distinctes par besoin métier :

### 1) Panier : Redis Cluster comme couche chaude, PostgreSQL comme source de vérité durable

- Le panier est servi depuis un cache distribué en mémoire (Redis Cluster) pour garantir des temps de lecture très faibles et une haute disponibilité sous charge.
- La base de données principale (PostgreSQL ou équivalent relationnel) reste la source de vérité durable pour les données métier critiques, notamment les commandes et les références produit.
- Les écritures de panier passent d'abord par le cache chaud, puis sont répliquées / persistées en arrière-plan dans la base transactionnelle.
- Si la base principale est indisponible temporairement, la session panier continue de fonctionner depuis le cache, ce qui respecte la contrainte de disponibilité du panier.

Cette décision est justifiée par le fait que le panier est un accès extrêmement fréquent et critique, alors que la base principale est un stockage durable plus coûteux en latence et plus sensible aux pannes ou à la saturation.

### 2) Audit légal : journal append-only séparé de la base transactionnelle

- Tous les événements métiers sensibles (ajout/suppression d'articles, validation panier, paiement, annulation, statut commande, etc.) sont envoyés vers un flux d'événements d'audit.
- Ce flux est ensuite conservé dans un stockage append-only immuable, tel qu'un objet WORM ou une archive de logs append-only avec signatures/hachage.
- Les journaux sont séparés de la base transactionnelle pour éviter que leur intégrité ne dépende de la même base que les opérations business.
- Une chaîne de hachage ou signature cryptographique permet de prouver qu'aucun historique n'a été supprimé ou modifié sans laisser de trace.

Cette décision répond explicitement à la contrainte légale d'inaltérabilité : l'audit ne vit pas dans le même périmètre que les données opérationnelles, ce qui évite les risques de suppression, corruption ou modification par erreur ou malveillance.

### 3) Paiement : orchestration asynchrone avec file de traitement

- Le parcours de paiement ne passe pas directement par l'API bancaire en synchronie.
- Le système enregistre une demande de paiement, l'insère dans une file de traitement fiable, puis le worker de paiement appelle l'API bancaire externe.
- Les callbacks/status de paiement sont remis dans la logique métier après traitement.
- L'échange avec l'API bancaire est idempotent pour éviter les doublons en cas de retry.

Cette décision découple le système de l'API bancaire très lente et évite de bloquer le flux e-commerce sur une latence de ~4 s. Le client ne paie pas le coût de cette latence sur le parcours critique.

## Alternatives envisagées et rejetées

### Alternative 1 : stocker le panier uniquement dans PostgreSQL

- Pourquoi elle a été envisagée : c'est le modèle classique, simple et durable.
- Pourquoi elle a été rejetée :
  - la latence de lecture/écriture pour un panier très fréquent risque de dépasser 50 ms sous charge ;
  - une panne de la base principale empêcherait immédiatement l'usage du panier, ce qui contredit la contrainte de disponibilité.
- Conclusion : acceptable comme source de vérité durable, mais insuffisante comme couche chaude du panier.

### Alternative 2 : utiliser une base NoSQL pour toutes les données de panier et de commandes

- Pourquoi elle a été envisagée : elle est souvent choisie pour la performance et la scalabilité.
- Pourquoi elle a été rejetée :
  - le projet ne fournit pas une justification de besoin pour une base NoSQL hébergeant toute l'activité transactionnelle ;
  - les données de commande et de catalogue restent métier critiques et ont besoin d'une forte cohérence transactionnelle, où le modèle relationnel est plus explicite et robuste ;
  - l'objectif est de résoudre une contrainte spécifique (panier ultra-rapide), pas d'introduire un changement de base global pour la plateforme.
- Conclusion : pas de valeur ajoutée suffisante pour justifier une architecture plus complexe.

### Alternative 3 : stocker les logs d'audit directement dans la base relationnelle avec des tables de journalisation

- Pourquoi elle a été envisagée : c'est la solution la plus simple du point de vue de l'implémentation.
- Pourquoi elle a été rejetée :
  - elle ne fournit pas d'élément d'inaltérabilité vérifiable ;
  - un administrateur, un incident applicatif, ou un attaquant qui accède à la base peut modifier ou supprimer les traces ;
  - la contrainte légale impose un mécanisme de preuve d'intégrité, autrement dit un stockage séparé et append-only.
- Conclusion : ce n'est pas une solution de conformité juridique robuste, seulement une solution de traçabilité opérationnelle.

### Alternative 4 : appel bancaire synchrones depuis le checkout

- Pourquoi elle a été envisagée : la voie la plus simple techniquement, sans queue ni orchestration.
- Pourquoi elle a été rejetée :
  - le temps moyen de réponse de 4 s injecte un temps de blocage direct dans le parcours utilisateur ;
  - cela dégrade le service d'achat face à une latence déjà critique ;
  - la plateforme a besoin d'un flux de paiement tolérant aux latences externes et réactif.
- Conclusion : la file d'attente asynchrone est la solution la plus cohérente avec la contrainte réelle de performance.

## Conséquences

### Avantages

- Panier extrêmement rapide et robuste à la panne de la base transactionnelle.
- Traçabilité légale forte grâce à un journal d'audit séparé et inaltérable.
- Paiement découplé de la latence de l'API bancaire, avec meilleure résilience et meilleure expérience utilisateur.
- Architecture minimale et ciblée : aucun besoin d'un grand nombre de services ou de multi-région non justifiés.

### Inconvénients / coûts

- Il faut deux chemins de données distincts : le chemin chaud pour le panier et le chemin durable pour les transactions.
- Le système d'audit impose une stratégie de conservation, de signature et de rotation des journaux.
- Les événements de paiement et de panier doivent être conçus avec idempotence et cohérence de réplication pour éviter les divergences entre cache et base.

### Risques à gérer

- Récupération du cache Redis après une panne : besoin de mécanisme de rebuild ou de replay depuis les événements et la base durable.
- Différences temporaires entre le cache et la base principale : il faut définir une stratégie claire d'eventual consistency pour les données non critiques du panier.
- Propriété de l'audit : le stockage immuable doit être isolé et protégés contre les modifications, avec une politique de conservation et de contrôle d'accès claire.

## Conclusion

Le choix retenu vise à résoudre précisément les trois contraintes du projet sans ajouter de complexité inutile. Le panier est traité sur un cache rapide, l'audit est séparé dans un journal immuable, et le paiement est dissocié de la latence bancaire. Cette architecture est volontairement minimaliste, ciblée et justifiée par les contraintes métier réelles plutôt que par des standards de conception génériques.
