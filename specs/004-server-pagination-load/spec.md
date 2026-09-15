# Pagination du registre et préparation de mesure

2026-09-15 — Suite du lot 003, autorisée par le propriétaire.

Le registre Alertes doit demander une seule page au serveur (8 lignes), avec
recherche littérale, pays, secteur, qualification et vue prioritaire/par pays.
Les compteurs restent des totaux serveur sur le périmètre autorisé, jamais ceux
d'une page. Une erreur n'affiche ni anciennes données ni simulation de secours.
L'export devient explicitement celui de la page visible. Le chargement global
ne doit plus bloquer ce registre ni les pages sans besoin du jeu complet.

La carte, les analyses, les rapports, la vue stratégique, l'État membre et le
dossier conservent transitoirement le chargement complet borné du lot 003 :
aucune statistique ne sera calculée sur une page présentée comme un jeu complet.
Leur migration vers des agrégats/spatial serveur reste un lot ultérieur.

Préparer un protocole reproductible k6 avec montée progressive jusqu'à 1 000
utilisateurs virtuels indépendants, seuils et arrêt sur erreurs. Ce test couvre
les lectures du Hub, pas une certification des chats, uploads, IA ou du rendu.
L'utilisateur confirme ne disposer QUE de production à deux workers : aucune
charge distante n'est autorisée dans ce lot. L'exécution et la capacité restent
explicitement non validées tant qu'une préproduction isolée n'est pas disponible.
