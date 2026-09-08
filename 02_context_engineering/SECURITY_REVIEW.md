# SECURITY_REVIEW.md — Refactoring et sécurisation itérative d'une faille d'injection

## Le prompt utilisé

```
Tu es expert en sécurité Node.js.

Contexte : j'ai attaché le fichier legacy_auth.js. Le fichier test_security.js doit continuer à passer. Voici le résultat actuel de `node test_security.js` :

haitu@DESKTOP-PBR30RA:~/Holberton-Specialisation/holbertonschool-agentic-ai/02_context_engineering$ node test_security.js
=== Début de la suite de tests de sécurité (Tâche 2) ===

Test 1 : Connexion légitime...
[DB ENGINE] Exécution de la requête : SELECT * FROM users WHERE email = 'dev@entreprise.com' AND password = 'password123'
-> OK

Test 2 : Tentative d'injection SQL...
[DB ENGINE] Exécution de la requête : SELECT * FROM users WHERE email = 'admin@entreprise.com' OR '1'='1' AND password = 'hack'
❌ FAILED: FAILLE CRITIQUE DÉTECTÉE : L'injection SQL a réussi ! Votre prompt IA n'a pas sécurisé la requête.
true !== false
-> Relancez votre Agent avec de meilleures instructions pour corriger la faille.

Tâche : corriger la faille d'injection SQL dans authenticateUser.

Contraintes :
- Utiliser une requête préparée/paramétrée (pas de concaténation de chaînes dans la requête SQL).
- Ne pas changer la signature de la fonction authenticateUser.
- Ne pas changer l'objet de retour en cas de succès.
- Le mock db.query (dans le même fichier) peut être adapté si nécessaire pour que la requête paramétrée soit correctement interprétée — il n'est pas couvert par les contraintes ci-dessus, contrairement à authenticateUser.

Format : analyse le code, propose le correctif, puis explique brièvement pourquoi ça corrige la faille sans casser le Test 1.
```

## Résumé de la vulnérabilité identifiée

Injection SQL classique par **concaténation directe** des paramètres `email` et `password` dans la chaîne de requête SQL construite dans `authenticateUser` (`src/legacy_auth.js`). Cette construction permettait à un attaquant d'injecter du SQL arbitraire via le champ `email`, par exemple `admin@entreprise.com' OR '1'='1`, ce qui transformait la clause `WHERE` en condition toujours vraie et contournait totalement la vérification du mot de passe.

## Résumé des modifications proposées par l'Agent

- Passage à une **requête paramétrée** dans `authenticateUser` : les valeurs `email` et `password` ne sont plus concaténées dans la chaîne SQL, mais passées séparément via des placeholders (`$1`, `$2`) et un tableau de valeurs.
- Adaptation du **mock `db.query`** (même fichier) pour qu'il interprète correctement les placeholders et le tableau de paramètres, conformément à la marge de manœuvre laissée dans le prompt.
- **Signature de `authenticateUser` inchangée** et **objet de retour en cas de succès inchangé**, conformément aux contraintes du prompt — aucune régression fonctionnelle introduite.

## Résultats des tests avant / après correction

**Avant :**
```
=== Début de la suite de tests de sécurité (Tâche 2) ===

Test 1 : Connexion légitime...
[DB ENGINE] Exécution de la requête : SELECT * FROM users WHERE email = 'dev@entreprise.com' AND password = 'password123'
-> OK

Test 2 : Tentative d'injection SQL...
[DB ENGINE] Exécution de la requête : SELECT * FROM users WHERE email = 'admin@entreprise.com' OR '1'='1' AND password = 'hack'
❌ FAILED: FAILLE CRITIQUE DÉTECTÉE : L'injection SQL a réussi ! Votre prompt IA n'a pas sécurisé la requête.
true !== false
-> Relancez votre Agent avec de meilleures instructions pour corriger la faille.
```

**Après :**
```
=== Début de la suite de tests de sécurité (Tâche 2) ===

Test 1 : Connexion légitime...
[DB ENGINE] Exécution de la requête : SELECT * FROM users WHERE email = $1 AND password = $2
-> OK

Test 2 : Tentative d'injection SQL...
[DB ENGINE] Exécution de la requête : SELECT * FROM users WHERE email = $1 AND password = $2
-> OK
✅ PASSED: Le code a été correctement sécurisé par l'agent IA.
```

Les deux tests passent après correction, sans régression sur le comportement légitime (Test 1) : la faille d'injection est corrigée et le contrat fonctionnel de `authenticateUser` (signature, objet de retour) a été préservé.