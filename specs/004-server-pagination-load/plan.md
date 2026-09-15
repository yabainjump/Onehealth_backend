# Plan et Constitution Check

1. Étendre le DTO existant avec vue whitelistée, propager au repository ; conserver
   le filtrage pays avant recherche, tri stable et pagination ; borner le temps Mongo.
   Résumé : une agrégation avec $match pays en premier, délai 5 secondes, à la place
   des huit requêtes existantes ; mêmes totaux et contrat de démonstration.
2. Ajouter un magasin de page côté Angular, annulant les anciennes requêtes à tout
   changement de filtres/session et à sa destruction ; temporiser la recherche.
3. Brancher le registre, totaux serveur, loader de marque, erreur/réessai et export
   clairement limité à la page. Déplacer le resolver complet sur ses consommateurs.
4. Ajouter un scénario k6 non déployé et son garde-fou testable sans réseau : cible
   de préproduction explicite, liste d'identités de test, aucun secret dans les logs.
5. Tests DTO, repository/scope, frontend/requêtes/routes, garde-fous ; lint/build ; docs.

Constitution Check : JWT/HubAccessGuard et resolveHubCountryScope conservés ;
aucun rôle, quota ou contrôle de validation humaine affaibli. Mongo/Hub nommé
inchangés, aucun Redis/SQL/nouveau service runtime. Tri déterministe et taille
maximale 100, plafond page 1000 conservés. Pas de migration destructive ni écriture
production ; uploads partagés hors releases inchangés. Spec Kit et scripts k6
hors dist. Les modifications non commitées du lot 003 sont préservées.

Limites : offset borné, pas snapshot transactionnel entre total et lignes ; les
nouvelles observations peuvent déplacer les pages. Charge 1 000 non exécutée,
pas de certification sécurité/capacité. Préproduction et générateur séparés requis.
