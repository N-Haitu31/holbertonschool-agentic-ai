# CONTEXT.md — Le Défi du Contexte Implicite et de l'Architecture

## Le prompt utilisé

```
tu es expert en Node.js
ces deux fichiers représentent l'architecture existante à respecter "user.repository.js et user.service.js"
Tâche: créer un nouveau service d'export de données dans src/services/
Contraintes : reproduire exactement le pattern repository/singleton et la gestion d'exception (throw new Error en français) déjà en place
Format : uniquement le code
```

Le prompt suit volontairement le patron Rôle-Contexte-Tâche-Contraintes-Format vu dans le concept de prompt engineering "code-centric" du projet.

## Les fichiers fournis en contexte

- `src/repositories/user.repository.js`
- `src/services/user.service.js`

Les deux fichiers ont été ajoutés en pièces jointes dans Copilot Chat (chips visibles en haut de la conversation), pour forcer l'IA à analyser l'architecture existante avant de générer quoi que ce soit — plutôt que de la laisser deviner un pattern à partir de rien, comme observé lors du projet précédent sur la dette sémantique.

## Le service généré

**Chemin** : `02_context_engineering/src/services/data-export.service.js`

```javascript
const userRepository = require('../repositories/user.repository');

class DataExportService {
    async exportUserData(email) {
        const user = await userRepository.findByEmail(email);
        if (!user) {
            throw new Error("Utilisateur introuvable dans le système");
        }
        return user;
    }
}

module.exports = new DataExportService();
```

## Résumé — éléments de l'architecture repris et limite observée

**Pattern respecté.** Copilot a correctement identifié et reproduit les conventions du projet à partir du seul contexte fourni : le require relatif vers `../repositories/`, l'export en singleton (`module.exports = new DataExportService()`, identique au pattern de `user.service.js`), et surtout la gestion d'exception avec `throw new Error(...)` rédigé **en français**, exactement dans le style déjà en place (message métier explicite plutôt qu'un code d'erreur générique).

**Limite observée #1 — logique d'export absente.** Le service généré n'implémente aucune véritable logique d'export : `exportUserData` se contente de récupérer l'utilisateur via le repository et de le retourner tel quel, sans transformation, sérialisation (CSV/JSON) ni écriture de fichier — ce qui correspond en réalité à un simple `getUserData` renommé. Rien dans le prompt ne précisait le format de sortie attendu ni ce que "exporter" signifie concrètement ici, et Copilot a comblé ce vide par l'option la plus sûre statistiquement (retourner l'objet tel quel) plutôt que d'halluciner une logique métier absente du contexte fourni.

**Limite observée #2 — déviation sur l'appel repository.** Dans `user.service.js`, l'appel au repository n'est pas précédé d'`await` (`const user = userRepository.findByEmail(email);` — seule la méthode englobante est `async`, l'appel lui-même est synchrone puisque `findByEmail` ne retourne pas de Promise). Dans le service généré, Copilot a ajouté un `await` sur cet appel (`const user = await userRepository.findByEmail(email);`) qui n'existait pas dans l'original. Sans conséquence fonctionnelle ici (`await` sur une valeur non-Promise ne change rien à l'exécution), mais c'est une petite déviation par rapport à une reprise fidèle du pattern — Copilot a plaqué une convention `async/await` "par défaut" plutôt que de reproduire exactement ce qu'il avait sous les yeux.

Ces deux limites illustrent le même phénomène vu dans le concept du projet : le RAG local restitue fidèlement le *style* général du projet (conventions de nommage, gestion d'erreurs), mais ne garantit pas une reprise pixel-perfect de chaque détail syntaxique, ni ne devine une intention métier qui n'a jamais été explicitée.