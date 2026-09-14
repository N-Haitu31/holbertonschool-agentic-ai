
- **User Stories**
	- En tant qu’opérateur du traitement des tâches, je veux qu’un script consulte `tasks.json` périodiquement afin de connaître l’action de la première tâche en attente.
	- En tant qu’opérateur du traitement des tâches, je veux voir cette action dans la console afin de pouvoir suivre l’activité du script.
	- En tant qu’opérateur du déploiement, je veux exécuter le script sous Docker afin de disposer d’un environnement d’exécution reproductible.

- **Critères d’acceptation**
	- **Given** un fichier `tasks.json` lisible contenant au moins une tâche avec le statut `pending`, **When** un cycle de consultation est exécuté, **Then** l’action de la première tâche dont le statut est `pending` dans l’ordre du fichier est affichée dans la console.
	- **Given** plusieurs tâches avec le statut `pending`, **When** un cycle de consultation est exécuté, **Then** seule l’action de la première tâche `pending` est affichée.
	- **Given** une tâche `pending` située après une ou plusieurs tâches ayant un autre statut, **When** un cycle de consultation est exécuté, **Then** l’action affichée est celle de la première tâche `pending`, sans tenir compte des tâches précédentes qui ne sont pas `pending`.
	- **Given** un cycle de consultation terminé, **When** le délai de 5 secondes est écoulé, **Then** un nouveau cycle de consultation de `tasks.json` est exécuté.
	- **Given** une tâche `pending` toujours présente entre deux cycles, **When** le cycle suivant est exécuté, **Then** son action est de nouveau affichée dans la console.
	- **Given** aucune tâche avec le statut `pending`, **When** un cycle de consultation est exécuté, **Then** aucune action de tâche n’est affichée et le script attend le cycle suivant.
	- **Given** l’exécution du script dans l’environnement prévu, **When** le conteneur Docker est démarré, **Then** le script démarre automatiquement et applique le comportement défini par ces spécifications.

- **Contraintes techniques explicites**
	- Le fichier de référence est `tasks.json`.
	- La consultation est répétée en boucle.
	- L’intervalle entre deux consultations est fixé à 5 secondes.
	- L’action de la tâche sélectionnée est affichée dans la console.
	- L’exécution doit fonctionner sous Docker.
	- La sélection respecte l’ordre des tâches dans `tasks.json`.
	- Le statut recherché est exactement `pending`.
	- Le script ne modifie pas le statut des tâches dans le cadre de ce besoin.
    - Le script doit tourner indéfiniment (boucle infinie assumée), et ne s'arrête que sur interruption manuelle (Ctrl+C) ou arrêt du conteneur Docker — ce n'est pas un oubli mais un comportement voulu.

- **Ambiguïtés identifiées et résolues**
	- **Définition de « première tâche »** : il s’agit de la première tâche ayant le statut `pending` selon l’ordre du tableau dans `tasks.json`.
	- **Plusieurs tâches `pending`** : seule la première est retenue et une seule action est affichée par cycle.
	- **Absence de tâche `pending`** : aucune action n’est affichée ; la boucle continue et effectue une nouvelle consultation après 5 secondes.
	- **Fin d’un cycle** : le cycle se termine après la sélection et l’affichage éventuel de l’action, puis le délai de 5 secondes commence avant le cycle suivant.
	- **Modification du statut** : le statut n’est pas modifié après l’affichage ; une même action peut donc être affichée à plusieurs cycles successifs.
	- **Fichier `tasks.json` absent, illisible ou invalide** : le script signale l’erreur dans la console et ne considère aucune tâche comme disponible pour le cycle concerné, puis reprend au cycle suivant après 5 secondes.
	- **Tâche sans action exploitable** : une tâche `pending` dont l’action est absente ou vide n’est pas affichée ; le script signale le problème dans la console et poursuit la recherche de la prochaine tâche `pending` exploitable dans le même cycle.
