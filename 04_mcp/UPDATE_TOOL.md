# UPDATE_TOOL.md — Mode Ingénieur (Développement d'un nouvel Outil MCP)

## Nom du Tool ajouté

`update_customer_status`

Ajouté dans `mcp_server.js`, en suivant exactement la même structure/API MCP que le Tool existant `get_customer_status` (déclaration dans `ListToolsRequestSchema`, logique dans `CallToolRequestSchema`), sans refonte du serveur.

## Prompt utilisé pour l'implémentation

```
Tu es un expert Node.js / MCP.

Contexte : j'ai attaché mcp_server.js. Le fichier contient un commentaire TODO (Tâche 3) marquant l'endroit où ajouter la nouvelle fonctionnalité.

Tâche : implémenter le TODO "Tâche 3" — ajouter un nouvel outil update_customer_status permettant de modifier le statut d'un client.

Contraintes :
- Deux arguments obligatoires : email (string), new_status (string).
- Dans ListToolsRequestSchema : déclarer l'outil avec son inputSchema.
- Dans CallToolRequestSchema : si l'email existe dans DATABASE, mettre à jour son statut et renvoyer un message de succès (texte). Si l'email n'existe pas, gérer le cas proprement.
- Garder exactement la même structure/API MCP que l'existant (get_customer_status) — pas de refonte, pas de changement de conventions.

Format : montre-moi le code modifié, puis explique brièvement ce que tu as ajouté.
```

## Paramètres transmis lors du test

Prompt de test envoyé à Copilot Chat après redémarrage du serveur MCP (`Developer: Reload Window`) :

```
Exécute explicitement l'outil MCP update_customer_status pour passer le client dev@entreprise.com en statut Inactif
```

Paramètres affichés par Copilot avant exécution du Tool :

```json
{
  "email": "dev@entreprise.com",
  "new_status": "Inactif"
}
```

## Résultat retourné par le Tool

```
Le client dev@entreprise.com a maintenant le statut : Inactif
```

Ce message correspond exactement au message de succès codé dans `mcp_server.js` (`` `Succès: le statut du client ${email} a été mis à jour en "${newStatus}".` ``), ce qui confirme que le Tool a bien exécuté la mise à jour côté `DATABASE` et non renvoyé une réponse générée par le modèle sans exécution réelle.

## Vérification effectuée avant autorisation (Human-in-the-Loop)

Avant de cliquer sur "Autoriser", le nom exact du Tool (`update_customer_status`) et les deux paramètres transmis (`email: dev@entreprise.com`, `new_status: Inactif`) ont été vérifiés dans la fenêtre de confirmation HITL. Point notable observé à cette occasion : contrairement à l'appel en lecture seule de `get_customer_status` (Tâche 1), la fenêtre d'autorisation affichait ici un avertissement supplémentaire signalant que l'appel *"changes workspace state"* — cohérent avec le fait que ce Tool modifie effectivement une donnée (le statut client), alors que le précédent ne faisait que lire.

## Annexe — code ajouté dans `mcp_server.js`

```javascript
// 3. Déclaration des Outils (Ce que Copilot peut voir)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_customer_status",
        description: "Récupère le statut et l'état de la commande d'un client via son email.",
        inputSchema: {
          type: "object",
          properties: {
            email: { type: "string", description: "L'email du client (ex: dev@entreprise.com)" }
          },
          required: ["email"]
        }
      },
      {
        name: "update_customer_status",
        description: "Met à jour le statut d'un client via son email.",
        inputSchema: {
          type: "object",
          properties: {
            email: { type: "string", description: "L'email du client (ex: dev@entreprise.com)" },
            new_status: { type: "string", description: "Le nouveau statut à assigner au client" }
          },
          required: ["email", "new_status"]
        }
      }
    ]
  };
});

// 4. Exécution de la logique (Ce que Copilot peut faire)
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "get_customer_status") {
    const email = request.params.arguments.email;
    const data = DATABASE[email];

    if (!data) {
      return {
        content: [{ type: "text", text: `Erreur: Aucun client trouvé pour l'email ${email}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
    };
  }

  if (request.params.name === "update_customer_status") {
    const email = request.params.arguments.email;
    const newStatus = request.params.arguments.new_status;
    const data = DATABASE[email];

    if (!data) {
      return {
        content: [{ type: "text", text: `Erreur: Aucun client trouvé pour l'email ${email}` }],
        isError: true,
      };
    }

    data.status = newStatus;

    return {
      content: [{ type: "text", text: `Succès: le statut du client ${email} a été mis à jour en "${newStatus}".` }]
    };
  }

  throw new Error("Outil inconnu");
});
```