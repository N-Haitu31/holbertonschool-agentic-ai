# MÉMOIRE PROJET : E-Commerce Agentic

## 🛠️ Stack & Conventions
- Environnement : Node.js (Vanilla JavaScript)
- Framework de test : Jest
- Pas de TypeScript pour ce micro-service.

## 📐 Décisions Architecturales (Historique)
- Les prix sont manipulés avec précaution. L'application principale gère des centimes, mais le `cart_calculator.js` actuel est une version legacy qui renvoie des Euros avec 2 décimales. Cette dette technique est connue.
- **Règle Absolue de QA :** Interdiction stricte de refactoriser ou modifier la logique métier du dossier `/src` lors des phases de génération de tests. L'Agent QA ne fait que du test.

## 📊 État Actuel & Prochaine Étape
- Besoin critique : Couvrir le calculateur de panier avec une suite de tests unitaires robuste avant toute migration.
