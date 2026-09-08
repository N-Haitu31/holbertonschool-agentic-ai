Feature: Authentification Utilisateur
  Scenario: Connexion réussie avec identifiants valides
    Given un utilisateur avec l'email "dev@entreprise.com" existe en base
    When l'utilisateur soumet ses identifiants valides
    Then le système doit générer un token JWT valide