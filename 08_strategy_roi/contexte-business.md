# Contexte Projet : "MegaShop-B2B"

Nous devons construire une nouvelle plateforme d'achat de gros pour des professionnels.
Le trafic attendu est de 50 000 utilisateurs simultanés aux heures de pointe.

Contraintes techniques :
1. Le panier d'achat doit être extrêmement rapide (latence < 50ms) et rester disponible en cas d'indisponibilité temporaire de la base de données principale.
2. Nous devons stocker l'historique complet de toutes les actions (logs d'audit inaltérables) à des fins légales.
3. Le système de paiement doit interagir avec une API bancaire externe très lente (temps de réponse moyen de 4 secondes).

Utilisez l'IA pour proposer une architecture technique argumentée répondant à ces contraintes.
