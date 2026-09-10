# MCP_SETUP.md — Déploiement du Serveur CRM et Interfaçage

## Nom du serveur MCP configuré

- **Clé configurée dans `.vscode/mcp.json`** : `crm-server`
- **Nom interne exposé par le serveur** (visible dans le panneau Tools de Copilot) : `crm-mock-server`

Ces deux noms sont différents et il ne faut pas les confondre : `crm-server` est l'identifiant choisi côté configuration locale (`.vscode/mcp.json`), tandis que `crm-mock-server` est le nom que le serveur MCP s'attribue lui-même une fois démarré — c'est ce second nom qui apparaît dans l'interface de Copilot et qui préfixe le tool exposé (`crm-mock-serv_get_customer_status`).

## Nom du Tool CRM détecté dans Copilot

`get_customer_status` — trouvé et activé dans le **panneau Tools du mode Agent** de Copilot Chat.

> **Problème rencontré :** le tool n'apparaît pas via l'icône trombone / pièces jointes (`+`) du chat, contrairement à ce qu'on pourrait attendre en premier réflexe — ce qui a fait perdre du temps à chercher au mauvais endroit. **Résolution :** il faut ouvrir le panneau **Tools** dédié au mode Agent pour voir le tool dans la liste et le cocher/activer.

## Résumé du résultat de la vérification

**Ce qui a fonctionné.** Un appel réel de `get_customer_status(ceo@entreprise.com)` a été déclenché depuis Copilot Chat. La validation Human-In-The-Loop (HITL) a été passée via le bouton "Autoriser dans cette session". Le résultat retourné par Copilot est identique à celui obtenu indépendamment via MCP Inspector, ce qui confirme que le serveur et le tool fonctionnent correctement de bout en bout :

```
id: 102
status: VIP
order_status: Retardée - Rupture de stock
```

**Question de vérification posée à Copilot Chat.** *"Quels sont les outils externes (MCP) auxquels tu as accès ?"* — réponse complète de Copilot Chat, reproduite ici comme preuve :

> Je vérifie bien la liste des outils MCP réellement exposés dans cette session pour te répondre précisément.
>
> **Outils MCP auxquels j'ai accès dans cette session**
> Les outils MCP réellement exposés ici sont principalement :
>
> Pylance / Python analysis
> `mcp_pylance_mcp_s_pylanceAnalyze`, `mcp_pylance_mcp_s_pylanceCheckSignatureCompatibility`, `mcp_pylance_mcp_s_pylanceDocuments`, `mcp_pylance_mcp_s_pylanceFileSyntaxErrors`, `mcp_pylance_mcp_s_pylanceImports`, `mcp_pylance_mcp_s_pylanceInstalledTopLevelModules`, `mcp_pylance_mcp_s_pylanceInvokeRefactoring`, `mcp_pylance_mcp_s_pylanceLSP`, `mcp_pylance_mcp_s_pylancePythonDebug`, `mcp_pylance_mcp_s_pylancePythonEnvironments`, `mcp_pylance_mcp_s_pylancePythonProfileExplorer`, `mcp_pylance_mcp_s_pylancePythonProfiling`, `mcp_pylance_mcp_s_pylanceRunCodeSnippet`, `mcp_pylance_mcp_s_pylanceSemanticContext`, `mcp_pylance_mcp_s_pylanceSettings`, `mcp_pylance_mcp_s_pylanceSyntaxErrors`, `mcp_pylance_mcp_s_pylanceUpdatePythonEnvironment`, `mcp_pylance_mcp_s_pylanceWorkspaceRoots`, `mcp_pylance_mcp_s_pylanceWorkspaceUserFiles`
>
> Base de données
> `dbclient-execute-query`, `dbclient-get-databases`, `dbclient-get-tables`
>
> Conteneurs / runtime
> `container-tools_get-config`
>
> **CRM mock**
> `mcp_crm-mock-serv_get_customer_status`
>
> **En résumé**
> Le plus important pour toi est que j'ai accès à : Pylance pour Python, debug, diagnostics et profiling ; un client DB ; un outil de configuration de conteneurs ; un mock CRM avec `get_customer_status`.

Le tool `mcp_crm-mock-serv_get_customer_status` apparaît explicitement dans cette liste, ce qui confirme indépendamment que le serveur `crm-server`/`crm-mock-server` est bien chargé et que son tool CRM est détecté par Copilot. Les autres outils listés (Pylance, client DB, conteneurs) proviennent vraisemblablement d'autres extensions VS Code installées plutôt que de `.vscode/mcp.json` — c'est confirmé pour Pylance (extension effectivement installée, et un seul fichier `mcp.json` trouvé sur la machine), mais déduit par élimination plutôt que vérifié précisément pour `dbclient` et `container-tools`. Dans tous les cas, ça ne remet pas en cause la configuration du serveur CRM elle-même.

**Conclusion.** Le serveur `crm-server` (exposé sous le nom `crm-mock-server`) est correctement chargé, le tool `get_customer_status` est détecté et opérationnel dans Copilot Chat, et l'exécution en conditions réelles retourne des données cohérentes avec la vérification indépendante faite via MCP Inspector.