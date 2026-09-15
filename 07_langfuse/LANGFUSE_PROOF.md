# Preuve de traçage Langfuse

## Task 1 — Instrumentation (Tracing)

Capture d'écran du détail d'une trace réelle générée par `agent.js` (`npm start`), visible dans le dashboard Langfuse du projet `Agentic-Ops-TP7` :

![Détail de la trace Langfuse pour Task 1](./langfuse_trace_task1.png)

### Ce que montre la capture

- **Trace** : `OpenAI.chat` — `2026-09-15 12:22:25`
- **Prompt envoyé (User)** : le `promptCritique` exact défini dans `agent.js` ("Agis comme un administrateur système...")
- **Réponse du modèle (Assistant)** : la réponse complète générée par `gemini-3.6-flash`
- **Consommation de tokens** : `30 prompt → 685 completion (Σ 1,750)`
- **Coût estimé** : `$0.002591`

## Task 2 — Post-Hook (FinOps & Scoring)

Capture d'écran d'une trace ultérieure, montrant le score de sécurité attaché après le Post-Hook :

![Détail de la trace Langfuse pour Task 2, avec le score securite_commande](./langfuse_trace_task2.png)

### Ce que montre la capture

- **Trace** : `OpenAI.chat` — `2026-09-15 14:01:41` — `id: cac211f9-5da9-4d1c-8f85-9021ada0cead`
- **Score attaché à la trace** : `securite_commande: 0.00` (visible directement dans l'arbre de la trace, à gauche)
- **Consommation de tokens** : `30 prompt → 624 completion (Σ 1,648)` — bien au-dessus du seuil de 150, ce qui a déclenché `console.error("ALERTE FINOPS : Seuil de tokens dépassé !")` dans le terminal au moment de l'exécution
- **Justification du score `0` (Critique)** : la réponse du modèle (section Assistant) contient littéralement `sudo rm -rf --no-preserve-root /`, ce qui correspond à la condition `intentionIA.includes("rm -rf")` codée dans `agent.js`
- Vérifié indépendamment via l'API publique Langfuse (`GET /api/public/scores`) : le score existe côté serveur avec `traceId` identique à celui de cette trace, avant même son affichage dans le dashboard

## Note sur le modèle utilisé

Le projet a été configuré pour utiliser l'API Gemini (via son point de compatibilité OpenAI) au lieu d'OpenAI directement, sur recommandation explicite du professeur — un compte OpenAI fraîchement créé n'a plus de crédit API gratuit par défaut, contrairement à ce que suggéraient les prérequis du projet. Gemini dispose d'un tier gratuit fonctionnel. Le wrapper `observeOpenAI` de Langfuse fonctionne à l'identique quel que soit le fournisseur réel derrière le client OpenAI.

## Note technique — délai d'affichage Langfuse

Le SDK `langfuse` épinglé dans `package.json` (`^3.0.0`) installe la dernière version 3.x disponible, dont l'API d'ingestion est annoncée comme dépréciée par Langfuse Cloud (confirmé par le champ `_deprecation` de leur API publique). Conséquence : une trace envoyée via ce SDK met environ 10 minutes à apparaître dans le dashboard, même si `await openai.flushAsync()` est bien appelé en fin de script. Ce n'est pas un dysfonctionnement du code — l'API publique de Langfuse confirme la réception immédiate de la trace, seul l'affichage dans le dashboard est différé.
