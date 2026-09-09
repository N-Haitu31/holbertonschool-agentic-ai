# 🛡️ STANDARD D'ENTREPRISE : TESTS UNITAIRES (SKILL QA)

En tant qu'Agent QA, tu dois strictement appliquer ce Skill lors de chaque génération de test.

## 1. Convention de nommage
Chaque bloc `it()` ou `test()` DOIT respecter la nomenclature suivante en anglais :
`should_[EXPECTED_BEHAVIOR]_when_[CONDITION]`
Exemple : `should_return_zero_when_cart_is_empty`

## 2. Le Pattern Arrange-Act-Assert (AAA)
Le corps du test doit être visuellement séparé en 3 blocs par des sauts de ligne, avec les commentaires explicatifs obligatoires :
- `// Arrange` : Préparation des variables mockées et du setup.
- `// Act` : Appel unique de la fonction à tester.
- `// Assert` : Vérification du résultat avec `expect()`.