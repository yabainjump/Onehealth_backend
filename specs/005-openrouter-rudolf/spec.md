# Migration du fournisseur IA de Rudolf vers OpenRouter

Le propriétaire choisit OpenRouter pour Rudolf communautaire et les quatre usages IA du Hub. La clé est exclusivement côté backend. Les contrats REST et NDJSON, les droits, le périmètre pays, le stockage des conversations et le caractère non officiel des sorties restent inchangés.

Critères d'acceptation :

- Sans clé, Rudolf est dégradé sans rendre l'API indisponible.
- Avec clé, réponse complète et streaming utilisent un modèle OpenRouter explicitement configuré.
- Timeout, annulation, quota, erreur d'authentification et erreur fournisseur sont traduits en erreurs applicatives sans exposer la réponse brute ni la clé.
- Les requêtes imposent l'exclusion des fournisseurs collectant les données et la rétention zéro ; absence de fournisseur compatible est un échec explicite, jamais un assouplissement implicite.
- Le contexte Hub continue d'être filtré et minimisé côté serveur avant l'appel ; Rudolf ne décide ni ne publie.
- La configuration et la procédure de déploiement/retour arrière sont documentées ; aucun secret réel n'entre dans Git.

Exclusions : changement de modèle de données, nouveaux endpoints, automatisation des alertes et test de charge sur la production.
