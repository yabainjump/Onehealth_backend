# Plan et Constitution Check

1. Substituer au service Groq un adaptateur OpenRouter dans `rudolf/`, sans changer ses consommateurs ni ses contrats HTTP.
2. Renommer les variables d'environnement, valider leur format, garder le fournisseur optionnel et vérifier que le bail distribué dépasse le timeout.
3. Tester requêtes et streaming (dont erreurs/annulation), configuration, readiness dégradée et régression Rudolf/Hub.
4. Synchroniser `.env.example` et les documents d'architecture/exploitation ; déployer backend seul puis effectuer un smoke test non destructif.

Constitution Check avant implémentation : les gardes, filtres de pays et prompts restent en amont du fournisseur. Aucun secret client ni changement de workflow. Le fournisseur ne devient pas une dépendance de readiness. Les sorties restent des brouillons auditables, les données simulées identifiées. Réponse du fournisseur non journalisée. Deux workers utilisent la même configuration, le bail Mongo existant couvre l'appel. Aucune migration Mongo. Retour arrière : redéployer la révision précédente avec l'ancienne configuration Groq conservée temporairement sur le serveur ; ne jamais effacer les médias.

Risque résiduel : OpenRouter transmet les prompts au fournisseur de modèle sélectionné ; même avec ZDR et `data_collection: deny`, une revue contractuelle/résidence des données demeure obligatoire avant données institutionnelles réelles.
