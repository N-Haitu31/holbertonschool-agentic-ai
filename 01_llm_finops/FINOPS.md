# FINOPS.md — Modélisation du coût d'une boucle agentique

## 1. Mesure du prompt système en tokens

Prompt mesuré (collé tel quel dans l'outil de tokenization) :

```
Tu es un agent expert en documentation logicielle.
Ton rôle est de lire le code fourni et de générer des commentaires d'en-tête détaillés pour chaque méthode.
Contraintes : Utilise le format JSDoc, liste tous les paramètres et le type de retour.
Ne génère que les commentaires, n'ajoute aucun autre texte narratif.
Code à analyser :
```

- **Outil** : OpenAI Tokenizer
- **Tokenizer / encodage utilisé** : "GPT-5.x & O1/O3" (encodage des modèles OpenAI récents)
- **Résultat** : **76 tokens** (334 caractères)

Le nombre de tokens dépend du tokenizer choisi — avec l'onglet "GPT-4 & GPT-3.5 (legacy)" (encodage `cl100k_base`), le compte aurait pu être différent. C'est pour ça que l'énoncé demande de préciser lequel a été utilisé.

## 2. Coût d'une exécution unique

- Contexte de base **P** = 76 (prompt système) + 15 000 (fichier de code injecté) = **15 076 tokens**
- Input itération 1 = 15 076 tokens · Output = 500 tokens
- Formule : `Coût = (Input / 1 000 000 × 5$) + (Output / 1 000 000 × 15$)`

```
Coût = (15 076 / 1 000 000 × 5$) + (500 / 1 000 000 × 15$)
     = 0,07538 $ + 0,0075 $
     = 0,08288 $
```

**Coût de la première exécution ≈ 0,08288 $ (environ 8,3 centimes).**

## 3. Modélisation de la boucle de 10 itérations

Le contexte de base P (= 15 076) reste fixe, mais chaque itération rajoute les 500 tokens de sortie de l'itération précédente à l'input suivant : `Input(n) = P + 500 × (n − 1)`.

| Itération | Input (tokens) | Output (tokens) | Coût ($) |
|---|---:|---:|---:|
| 1 | 15 076 | 500 | 0,08288 |
| 2 | 15 576 | 500 | 0,08538 |
| 3 | 16 076 | 500 | 0,08788 |
| 4 | 16 576 | 500 | 0,09038 |
| 5 | 17 076 | 500 | 0,09288 |
| 6 | 17 576 | 500 | 0,09538 |
| 7 | 18 076 | 500 | 0,09788 |
| 8 | 18 576 | 500 | 0,10038 |
| 9 | 19 076 | 500 | 0,10288 |
| 10 | 19 576 | 500 | 0,10538 |
| **Total (10 itérations)** | **173 260** | **5 000** | **0,9413** |

**Coût cumulé sur 10 itérations ≈ 0,9413 $**, pour 178 260 tokens consommés au total (173 260 en input + 5 000 en output).

## 4. Auto-évaluation

**Vérification de la formule.** La croissance est bien **linéaire**, pas exponentielle : chaque itération n'ajoute que les 500 tokens de sortie de l'itération précédente au contexte transmis, donc l'input croît d'un incrément constant (+500 tokens, soit +0,0025 $ de coût par itération), ce qui donne une suite arithmétique. Une croissance exponentielle supposerait que chaque itération multiplie le contexte (par exemple en renvoyant tout l'historique cumulé *plusieurs fois*), ce qui n'est pas le cas ici — il n'y a qu'un seul ajout de 500 tokens par tour.

**Piste de correction — troncature du contexte.** Au lieu de renvoyer tout l'historique accumulé à chaque appel, ne conserver que l'information strictement nécessaire (par exemple le dernier message d'erreur, plutôt que les 9 tentatives précédentes en entier) maintiendrait l'input proche d'une valeur quasi constante (≈ P = 15 076) au lieu de croître à chaque tour. Avec troncature, le coût des 10 itérations serait de 10 × 0,08288 $ = **0,8288 $** au lieu de 0,9413 $ — un gain d'environ 0,11 $ (≈ 12 %) rien que sur cet exemple à 10 tours. À l'échelle de milliers d'agents tournant en production sur des boucles bien plus longues, cet écart devient la différence entre un budget cloud maîtrisé et une fuite d'argent, exactement comme décrit dans le concept FinOps du projet.