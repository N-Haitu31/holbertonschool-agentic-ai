# CONTEXT_TEST.md — Task 2 : Le Crash Test (Saturation de l'attention)

## Ce que j'ai fait

Dans le chat qui avait déjà servi à générer les tests (task 1), j'ai collé 4 gros pavés de texte hors-sujet à la suite : histoire de la théorie des jeux et des enchères, un pavé de Lorem Ipsum, une recette de tarte Tatin mélangée à du droit comparé et des montagnes, et le cycle de Krebs. Le but : remplir l'historique pour voir si l'agent perdrait le fil.

Une fois ça envoyé, j'ai posé la question piège dans un message à part :
> "Au fait, rappelle-moi la règle de nommage exacte de nos tests selon nos guidelines d'entreprise ?"

Ensuite j'ai ouvert un nouveau chat, je l'ai réinitialisé avec le prompt de la task 0 (`@workspace Initialise-toi en lisant le fichier de mémoire du projet...`), et j'ai reposé exactement la même question pour comparer.

## Réponse dans le chat saturé (avant la purge)

> La règle exacte est :
> `should_[EXPECTED_BEHAVIOR]_when_[CONDITION]`
> Exemple : `should_return_zero_when_cart_is_empty`
> Chaque nom de test doit être en anglais et respecter ce format.

## Réponse dans le chat purgé (après réinit)

> La règle exacte est :
> `should_[EXPECTED_BEHAVIOR]_when_[CONDITION]`
> En anglais, pour chaque bloc `it()` ou `test()`.
> Exemple : `should_return_zero_when_cart_is_empty`
> Les tests doivent aussi suivre le pattern AAA, commenté avec `// Arrange`, `// Act` et `// Assert`.

## Ce que j'en pense

Les deux réponses sont bonnes, quasi identiques, pas d'oubli ni d'invention. Le résultat "l'agent perd la règle à cause du bruit" ne s'est pas produit chez moi — et c'est un résultat qui compte quand même, l'énoncé dit bien de ne pas forcer les choses.

Seule petite différence : la réponse d'après la purge est un poil plus complète (elle rajoute le pattern AAA sans qu'on le demande), la réponse d'avant s'en tient strictement à la question posée.

## Pourquoi ça n'a pas cassé, à mon avis

Je pense que le fichier `copilot-instructions.md` et la mémoire du projet ne sont pas traités comme de simples messages perdus dans l'historique, mais plutôt comme un contexte qui reste présent à chaque échange. Ça les rend costauds face au bruit, en tout cas pour ~7 paragraphes de blabla. Avec un historique beaucoup plus long (des dizaines de milliers de tokens), le résultat serait peut-être différent, mais je ne l'ai pas testé.

## Les limites de mon test

Quelques trucs qui peuvent avoir faussé le résultat, à prendre en compte plutôt qu'à ignorer :

- **Les onglets ouverts** : j'avais `cart_calculator.js`, `TEST_REPORT.md` et `CONTEXT_TEST.md` ouverts pendant tout le test. Certains outils IDE donnent accès au contenu des onglets ouverts en plus de la conversation, ce qui peut expliquer que rien ne se perde.
- **`@workspace` fait plus que "se souvenir"** : à chaque fois que je posais la question, l'interface affichait "Completed X steps" avant de répondre, donc l'agent allait probablement relire les fichiers sur le disque à chaque fois plutôt que de compter sur ce qu'il avait dit avant.
- **Le protocole n'est pas 100% équitable** : dans le chat purgé, je lui redemande explicitement de relire la mémoire avant de poser la question. Dans le chat saturé, je ne lui redemande rien avant la question piège. C'est normal, c'est ce que l'énoncé demande, mais ça veut dire que je compare deux façons de travailler (laisser filer vs. réinitialiser proprement) plus qu'une vraie expérience contrôlée.

## Test bonus : sans `@workspace` du tout

Pour essayer de trancher, j'ai ouvert un nouveau chat et posé la question direct, sans `@workspace` et sans lui redemander de relire quoi que ce soit :

> "Au fait, rappelle-moi la règle de nommage exacte de nos tests selon nos guidelines d'entreprise ?"

Réponse obtenue :
> La règle exacte est : `should_[EXPECTED_BEHAVIOR]_when_[CONDITION]`
> Exemple : `should_return_zero_when_cart_is_empty`
> Elle s'applique à chaque bloc `it()` ou `test()`, en anglais.

Encore une fois "Completed 4 steps" avant la réponse, donc l'agent est allé lire les fichiers tout seul, sans que je lui dise `@workspace`. Ça confirme un truc important : ce n'est pas `@workspace` qui déclenche la lecture du repo dans cet outil, l'agent le fait de lui-même parce que `copilot-instructions.md` lui impose de vérifier `MEMORY.md`/`TESTING_GUIDELINES.md` avant de répondre sur les tests, peu importe comment on lui pose la question.

## En résumé

3 essais, 3 résultats identiques. Ce qui rend l'agent fiable ici, ce n'est ni la purge du chat ni la syntaxe utilisée, c'est le fichier d'instructions persistant configuré en task 0 : il pousse l'agent à toujours revérifier la mémoire du projet avant de répondre sur les tests, quel que soit l'état de la conversation.
