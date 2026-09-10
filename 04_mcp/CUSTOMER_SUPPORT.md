# CUSTOMER_SUPPORT.md — L'Agent "Support Client" (Exécution d'un Tool de lecture)

## Le prompt utilisé

```
Un client se plaint que sa commande est bloquée. Son email est ceo@entreprise.com. Exécute explicitement l'outil MCP nommé get_customer_status pour trouver le statut de sa commande et rédige un brouillon d'email d'excuses techniques.
```

## Le Tool MCP exécuté

`get_customer_status`

Copilot a explicitement déclenché l'appel avant de rédiger quoi que ce soit, avec l'input suivant :

```
Completed with input: {
  "email": "ceo@entreprise.com"
}
```

## Statut de commande retourné par le CRM

- `id` : `102`
- `status` : `VIP`
- `order_status` : `Retardée - Rupture de stock`

Ce résultat est identique à celui obtenu précédemment via MCP Inspector et via la question de vérification posée à Copilot Chat (`MCP_SETUP.md`), ce qui confirme la cohérence de bout en bout du pipeline.

## Brouillon d'email généré par l'Agent

> **Objet :** Suivi de votre commande et mesures immédiates
>
> Bonjour,
>
> Je tiens avant tout à m'excuser sincèrement pour le retard affectant votre commande. Nous avons bien identifié que votre commande est actuellement en statut "Retardée – Rupture de stock", et je comprends que cela puisse être particulièrement frustrant, surtout pour un client de votre niveau et avec nos standards de service.
>
> Nous sommes conscients que cette situation n'est pas acceptable et nous travaillons activement avec nos équipes logistiques et fournisseurs pour accélérer la relance du stock et reprendre le traitement de votre commande dans les meilleurs délais.
>
> Nous avons également pris note de votre situation prioritaire et de votre statut VIP afin de vous donner une attention particulière. Nous vous tiendrons informé dès que nous aurons une date de livraison confirmée, et nous mettrons en place les mesures nécessaires pour minimiser encore davantage ce retard.
>
> Je m'excuse une nouvelle fois pour ce désagrément technique et organisationnel. Nous prenons ce problème très au sérieux et faisons tout notre possible pour corriger la situation rapidement.
>
> Cordialement,
> [Votre nom]
> [Votre fonction]
> [Nom de l'entreprise]

Le brouillon reprend explicitement les deux données réelles renvoyées par le Tool — le statut VIP et la cause précise du retard (rupture de stock) — plutôt qu'un texte générique, ce qui confirme que l'Agent a bien utilisé le résultat du Tool pour construire sa réponse.