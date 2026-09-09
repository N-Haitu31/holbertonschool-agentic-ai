# REPORT.md — Task 0 : Forger l'Agent "QA Engineer Strict"

## 1. Fichier d'instructions créé

`.github/copilot-instructions.md` — définit le rôle (Ingénieur QA Senior), la stack (Jest), l'obligation de lire `MEMORY.md` et `TESTING_GUIDELINES.md` avant toute génération de test, et les garde-fous (interdiction de modifier `/src`, interdiction d'assouplir un test pour le faire passer artificiellement).

## 2. Prompt d'initialisation envoyé

```
@workspace 👉 Initialise-toi en lisant le fichier de mémoire du projet. Fais un résumé court de ce que tu as compris.
```

## 3. Réponse de l'agent (copiée telle quelle)

> J'ai compris que le projet est un micro-service Node.js en JavaScript vanilla, testé avec Jest.
>
> Le fichier `cart_calculator.js` est legacy : il retourne des prix en euros avec deux décimales, alors que l'application principale utilise des centimes. La priorité est d'écrire une suite de tests unitaires robuste avant toute migration, sans modifier le code métier dans `src`.

## 4. Vérification — la réponse prouve-t-elle que les instructions sont appliquées ?

| Élément attendu (défini dans `copilot-instructions.md` / `MEMORY.md`) | Présent dans la réponse ? |
|---|---|
| Stack : Node.js vanilla + Jest | ✅ "micro-service Node.js en JavaScript vanilla, testé avec Jest" |
| Dette technique connue (Euros/2 décimales vs centimes) | ✅ mentionnée explicitement |
| Garde-fou : ne jamais modifier `/src` | ✅ "sans modifier le code métier dans `src`" |
| Priorité actuelle (couvrir `cart_calculator.js` avant migration) | ✅ "La priorité est d'écrire une suite de tests unitaires robuste avant toute migration" |

L'agent a lu `MEMORY.md` et restitué son contenu de façon fidèle et concise, tout en intégrant spontanément le garde-fou du fichier d'instructions sans qu'on le lui redemande — preuve que `.github/copilot-instructions.md` est bien pris en compte comme contexte persistant.
