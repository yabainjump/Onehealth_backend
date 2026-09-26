# Product Requirements Document — One Health Network

**Version :** 1.6  
**Date de référence :** 22 août 2026  
**Dernière mise à jour fonctionnelle :** 26 septembre 2026
**Statut :** cadrage du produit existant et de sa cible  
**Versionnement :** document canonique suivi dans `onehealth_backend/docs/project/`

## 1. Résumé du produit

One Health Network est un ensemble cohérent de trois applications :

1. une plateforme communautaire mondiale pour publier, collaborer, signaler et échanger autour de One Health ;
2. un Hub décisionnel régional destiné au contexte CEEAC, qui consolide des données humaines, animales et environnementales autorisées ;
3. un backend commun qui porte l’authentification, les données, les droits, les médias, Rudolf AI et les workflows du Hub.

Le produit ne remplace ni DHIS2, ni ARIS 3, ni CAPC-AC, ni les autorités nationales. Il évite la ressaisie inutile, conserve la provenance et transforme des données autorisées en observations comparables, signaux explicables, alertes vérifiées et rapports traçables.

Le domaine du Dashboard expose une landing publique de présentation avant toute authentification.
Elle explique la valeur régionale, les trois secteurs, l'interopérabilité et la souveraineté sans
charger ni révéler de donnée Hub. Toutes les fonctions opérationnelles restent derrière les gardes
d'accès de `/dashboard` et des routes institutionnelles. La landing et la connexion partagent une
animation de convergence légère, responsive et compatible avec la préférence système de réduction
des mouvements.

L'identité visuelle utilise les variantes officielles transparentes de One Health Network sur les
deux frontends. Aucun composant de marque ne doit réintroduire un fond blanc opaque autour du logo ;
les formats web et principal sont choisis selon la taille d'affichage, sans chargement distant.

## 2. Problèmes à résoudre

- Les informations One Health sont dispersées entre secteurs, pays et institutions.
- Les professionnels et communautés disposent de peu d’espaces spécialisés pour collaborer.
- Les formats, identifiants et niveaux de partage diffèrent selon les sources.
- Une proximité temporelle ou géographique est souvent confondue avec une causalité.
- Les décideurs ont besoin d’une vue régionale compréhensible sans perdre la provenance.
- Les données souveraines ne doivent jamais être exposées au-delà des droits accordés.
- L’IA peut accélérer la lecture, mais ne doit ni diagnostiquer, ni vérifier, ni publier une décision sanitaire.

## 3. Utilisateurs cibles

| Persona | Besoin principal | Produit utilisé |
|---|---|---|
| Citoyen ou sentinelle | publier, consulter et signaler un événement local | application communautaire |
| Professionnel certifié | partager une expertise, collaborer et suivre les alertes | application communautaire |
| Analyste Hub | rapprocher les données autorisées et préparer une analyse | Dashboard CEEAC |
| Vérificateur | prendre en charge un signal et rendre une décision justifiée | Dashboard CEEAC |
| Administrateur Hub | gérer connecteurs, souveraineté, scénario et accès institutionnels | Dashboard CEEAC |
| Administrateur global | modérer la communauté et attribuer les accès Hub | les deux interfaces |
| Décideur CEEAC | consulter la situation régionale et les rapports validés | Dashboard CEEAC |

## 4. Principes non négociables

1. **One Health uniquement :** relier santé humaine, animale, végétale et environnementale.
2. **Souveraineté avant analyse :** filtrer côté serveur avant tout calcul ou appel IA.
3. **Provenance conservée :** garder source, identifiant source, date, pays et transformation.
4. **Observation, signal et alerte distincts :** aucune alerte automatique sans décision humaine.
5. **IA assistive :** Rudolf génère des brouillons, jamais des validations.
6. **Données simulées explicitement marquées :** aucune ambiguïté avec des données officielles.
7. **Sécurité par défaut :** validation DTO, droits minimaux, secrets côté serveur et audit.
8. **Accessibilité réseau :** interfaces responsive et tolérantes aux connexions instables.
9. **Lisibilité institutionnelle :** le Dashboard utilise Inter auto-hébergée et une échelle
   typographique cohérente, avec des libellés fonctionnels d'au moins 12 px.
10. **Contrat unique :** les réponses REST du Dashboard sont typées depuis le contrat OpenAPI
    versionné par le backend ; les fichiers générés ne sont jamais modifiés à la main.
11. **Multilingue progressif :** français par défaut, avec fondation anglais, portugais et espagnol,
    préférence locale et repli déterministe sur le français.

## 5. Portée fonctionnelle

### 5.1. Application communautaire — P0 existant

- inscription par email et connexion Google ;
- profils, édition, certification et suivi d’utilisateurs ;
- fil de publications, médias, hashtags, likes et commentaires ;
- partage public de publications et profils avec métadonnées sociales ;
- messagerie privée, pièces jointes et notifications ;
- alertes communautaires géolocalisées, commentaires, filtres et carte ;
- administration et modération ;
- Rudolf spécialisé One Health avec historique privé et réponse progressive ;
- fonctionnement web/PWA et navigation mobile/desktop.

### 5.2. Hub régional CEEAC — P0 de démonstration existant

- authentification JWT et contrôle par rôle/pays ;
- 165 observations fictives normalisées couvrant 11 pays et 3 secteurs ;
- 33 connecteurs fictifs : DHIS2, ARIS 3 et CAPC-AC ;
- vue stratégique, carte, registre, analyses, rapports et supervision ;
- vue « État membre » calculée sur le seul périmètre pays autorisé, avec indicateurs, répartition sectorielle et file prioritaire ;
- centre d’aide contextuel avec parcours guidés, gouvernance et recherche dans les questions fréquentes ;
- profil Dashboard modifiable via l’API commune, avec lecture séparée des rôles et périmètres administrés ;
- politiques de souveraineté et journal d’audit ;
- distinction observation → événement consolidé → signal → alerte vérifiée ;
- moteur de scénario intersectoriel paramétrable entre deux États CEEAC, sur une
  période non future de 90 jours maximum ;
- rapport de fin de scénario distinct, simulé et non officiel, avec synthèse,
  chronologie, traçabilité, limites, impression/PDF et export HTML ;
- exécution du scénario accompagnée d’un modal plein écran : arrière-plan inerte et
  légèrement flouté, logo animé pendant le traitement, puis choix explicite entre
  continuer et afficher le rapport ;
- assignation, vérification ou rejet humains ;
- rapports opérationnels versionnés ;
- Rudolf en lecture seule pour synthèse d’alerte, projet de rapport, explication multisectorielle et questions sur le périmètre autorisé.

### 5.3. Cible pilote institutionnel — P1 non achevé

- conventions officielles de partage avec les institutions et pays pilotes ;
- connecteurs réels et authentifiés vers les sources autorisées ;
- mapping de nomenclatures, contrôle qualité et gestion des rejets ;
- validation géographique contre les frontières officielles ;
- observabilité, sauvegarde/restauration et objectifs RPO/RTO ;
- comptes institutionnels, révocation, journalisation et procédures opérateur ;
- règles de détection validées par des experts mandatés ;
- tests de charge, pentest, revue juridique et homologation ;
- stratégie de tuiles cartographiques compatible avec le trafic attendu ;
- tests adversariaux de Rudolf, revue de résidence des données OpenRouter et mesure des coûts/quotas.

### 5.4. P2 après validation du pilote

- canaux sentinelles intégrés sans redondance avec les plateformes sectorielles ;
- notifications institutionnelles SMS/email après règles et autorisations explicites ;
- multilingue institutionnel ;
- exports et interopérabilité validés ;
- traitement média asynchrone avec FFmpeg si le besoin est confirmé ;
- entrepôt géospatial ou analytique spécialisé seulement si les mesures le justifient.

## 6. Exigences fonctionnelles prioritaires

| ID | Exigence | Critère d’acceptation |
|---|---|---|
| FR-AUTH-01 | Un compte se connecte avec email ou Google | token valide, utilisateur public renvoyé, compte banni refusé |
| FR-COM-01 | Un membre publie et interagit | publication visible selon modération, médias sûrs, compteurs cohérents |
| FR-ALERT-01 | Un membre crée une alerte communautaire | catégorie et localisation validées, statut de vérification visible |
| FR-HUB-01 | Le Hub filtre les données selon le pays | impossible d’élargir la portée par un paramètre client |
| FR-HUB-02 | Une source est normalisée sans perdre sa provenance | identifiants source/canonique et payload brut traçables |
| FR-HUB-03 | Un rapprochement reste explicable | score, version de règle, raisons et observations sources disponibles |
| FR-HUB-04 | Une alerte exige une décision humaine | assignation, justification et transition valide obligatoires |
| FR-HUB-05 | Un rapport suit un workflow | DRAFT → IN_REVIEW → VALIDATED → PUBLISHED selon rôle |
| FR-HUB-06 | Un utilisateur consulte une vue nationale | seuls les pays déjà filtrés côté serveur sont proposés et agrégés |
| FR-HUB-07 | Un administrateur configure, exécute puis consulte un scénario terminé | il choisit deux États CEEAC distincts et une période non future de 90 jours maximum ; le serveur impose les trois flux, revalide tout, audite la configuration et l’interface bloque les doubles actions ; le rapport porte `simulated: true`, `official: false`, restitue pays/période, conserve les identifiants sources et ne crée aucune alerte |
| FR-ACCOUNT-01 | Un utilisateur met à jour son profil Dashboard | les champs sont validés puis persistés par `PATCH /users/me`; rôles et pays restent non modifiables |
| FR-AI-01 | Rudolf répond uniquement sur One Health | hors sujet refusé et limites explicites |
| FR-AI-02 | Rudolf Hub ne voit que le contexte autorisé | contexte construit serveur après contrôle des pays et rôles |
| FR-AI-03 | Rudolf ne modifie aucun workflow | aucune dépendance IA vers les services de transition |
| FR-AUDIT-01 | Toute action sensible est auditée | acteur, action, entité, pays, date et métadonnées minimales |

## 7. Exigences non fonctionnelles

### Sécurité et confidentialité

- mots de passe hachés avec bcrypt ;
- JWT de durée configurable et absence de secret dans les frontends ;
- validation en liste blanche avec rejet des champs inconnus ;
- CORS explicite en production et CSP adaptée aux ressources réellement utilisées ;
- uploads validés par taille, type réel, extension et URL sûre ;
- données personnelles minimisées dans l’IA et les journaux ;
- exports protégés contre les formules CSV ;
- aucune donnée nominative dans le démonstrateur Hub.

### Performance et disponibilité

Lot local du 14 septembre 2026 : polling du chat limité aux écrans actifs et visibles,
requêtes de rafraîchissement dédupliquées et bornées dans le temps, pagination Hub par
lots de trois. Une ancienne session ne doit pas repeupler les données en mémoire.
La capacité de 1 000 utilisateurs simultanés reste un objectif à mesurer, pas une
garantie. Le Hub conserve temporairement son chargement complet, avec refus explicite
au-delà de 10 000 observations : ce plafond technique n'est ni un objectif produit ni
une autorisation de tronquer les rapports. Résumés serveur et pagination par écran/bbox
doivent précéder un usage institutionnel à grand volume.

- pagination des listes et index sur filtres principaux ;
- réponses API dynamiques non mises en cache par un proxy ;
- médias mis en cache de manière contrôlée ;
- appels OpenRouter limités, temporisés et non bloquants pour les autres modules ;
- cible pilote à définir après mesures : p95, taux d’erreur, volume/jour et utilisateurs concurrents.

### Qualité et maintenabilité

- composants Angular réutilisables ;
- architecture NestJS contrôleur/service/repository ;
- DTO validés et erreurs explicites ;
- tests unitaires pour droits, transitions, déduplication, rendu et sécurité ;
- documentation synchronisée à chaque décision structurante.

## 8. Hors périmètre actuel

- diagnostic médical ou vétérinaire ;
- déclaration automatique d’une épidémie ;
- décision ou publication autonome par Rudolf ;
- remplacement des systèmes nationaux ;
- flux réels sans convention et autorisation ;
- données sanitaires nominatives dans le Hub ;
- migration générale vers SQL/Supabase/PostGIS sans besoin mesuré ;
- microservices, Kafka ou modèle prédictif autonome dans le MVP.

## 9. Indicateurs de succès

### Démonstrateur

- le seed est idempotent et restitue les 165 observations attendues ;
- les 11 pays et 3 secteurs sont représentés ;
- le scénario complet est démontrable sans incohérence ;
- son rapport de simulation est consultable et exportable sans être confondu avec un rapport officiel ;
- aucun rôle limité ne consulte un pays interdit ;
- une alerte ne peut être vérifiée sans assignation et justification ;
- Rudolf n’exécute aucune action de workflow ;
- les builds et tests critiques réussissent avant livraison.

### Pilote institutionnel

- taux de données acceptées/rejetées/dupliquées mesuré par connecteur ;
- délai entre ingestion, signal et décision mesuré ;
- disponibilité et fraîcheur des sources visibles ;
- incidents de souveraineté : objectif zéro ;
- proportion de rapports validés et délai de validation ;
- utilité de Rudolf évaluée par les analystes, avec taux de corrections humaines.

## 10. Définition de terminé

Une fonctionnalité est terminée seulement si :

1. le besoin et les droits sont définis ;
2. frontend, backend et modèle de données sont cohérents ;
3. les entrées, erreurs et états vides sont traités ;
4. les risques de sécurité sont examinés ;
5. les tests proportionnels au risque passent ;
6. les documents concernés sont mis à jour ;
7. un changement destiné à la production passe un smoke test après déploiement.

## 11. Décisions produit encore ouvertes

- pays et institutions du premier pilote ;
- propriétaire juridique du traitement et localisation d’hébergement ;
- nomenclatures officielles et contrats de données ;
- fréquence de synchronisation par source ;
- procédure de validation des règles de détection ;
- politique de conservation et de suppression ;
- langues et canaux de notification ;
- niveau d’intégration des sentinelles communautaires ;
- budget, quotas et politique d’usage de Rudolf ;
- solution cartographique institutionnelle.

## 12. Livraison locale : registre paginé (15 septembre 2026)

Le registre Alertes utilise maintenant une page serveur de 8 lignes : recherche,
pays, secteur, qualification et vues Toutes/À traiter/Par pays. Les totaux de
qualification viennent du serveur sur le périmètre autorisé. L'export CSV est
explicitement limité à la page visible. Loader de marque, erreur/réessai et absence
de fallback fictif font partie du contrat. Les recherches obsolètes sont annulées.

La carte, l'État membre, les analyses, les rapports, le dossier et la vue stratégique
conservent leur jeu complet borné du lot 003 ; leur migration n'est pas achevée.
Objectif 1 000 utilisateurs NON validé : production seule confirmée par le propriétaire.
Le scénario k6 préparé couvre uniquement les lectures Hub ; préproduction isolée
obligatoire avant toute campagne, puis scénarios chat/médias/Rudolf complémentaires.

## 13. Expérience cartographique unifiée (mise à jour : 21 septembre 2026)

Le Hub et l'application communautaire conservent leurs cartes Leaflet et leurs données existantes.
La carte régionale occupe désormais une surface de travail adaptée au viewport ; l'aperçu du tableau
de bord, la carte Alertes, le détail d'une alerte et la sélection d'un lieu utilisent la même
présentation cartographique sobre. Les secteurs restent distingués par couleur, tandis que la taille,
l'anneau et la pulsation reflètent uniquement gravité ou vérification disponibles. Les popups Alertes
présentent rapidement le quoi, le où, le niveau de gravité et le statut. Aucun signal, frontière ou
donnée sanitaire supplémentaire n'est créé par cette évolution visuelle.

Le Dashboard doit rendre les 165 points de démonstration sans multiplier inutilement les nœuds SVG :
Canvas pour les marqueurs principaux, SVG seulement pour les anneaux animés des niveaux moyen et fort.
Le chargement des tuiles ne passe pas
par le service worker, garde une marge mémoire limitée et affiche le loader de marque jusqu'à la fin
du premier lot, avec sortie de secours après six secondes. Cette optimisation ne constitue pas une
garantie de disponibilité du service public de tuiles.

Les onze États membres doivent garder un contour visible. Au survol, le pays reçoit un remplissage
translucide et une fiche compacte indiquant le nombre de données visibles, de signaux et d'alertes
vérifiées. Les marqueurs restent au-dessus de cette couche. Les géométries Natural Earth sont
embarquées localement, qualifiées d'indicatives et ne valent pas délimitation juridique officielle.

La fiche pays doit aussi présenter les secteurs visibles et la date de dernière observation. Chaque
État utilise une teinte territoriale distincte issue de la référence graphique fournie par le
propriétaire produit, avec un contour plus foncé de la même famille. Cette palette sert uniquement à
identifier les territoires ; les couleurs sémantiques de gravité sont réservées aux points et aux
libellés de statut. Cliquer un pays filtre les points et recentre la carte ; le panneau de filtres
offre un sélecteur équivalent et le résumé permet de revenir à tous les États. Le survol et la
sélection ne doivent jamais recouvrir les marqueurs sanitaires.

Toutes les surfaces cartographiques interactives proposent un contrôle plein écran accessible :
carte régionale, aperçu du tableau de bord, liste et détail des alertes, ainsi que sélection d'un
lieu. Le plein écran agrandit le conteneur Leaflet existant sans recharger les données ni dupliquer
la carte. La sortie reste possible par le bouton ou la touche `Échap`; un repli CSS couvre les
navigateurs mobiles qui ne prennent pas en charge l'API Fullscreen native. Après chaque transition,
la carte doit recalculer sa taille afin de rester entièrement visible.

Lorsqu'un État membre est sélectionné, lui seul conserve son remplissage ; les dix autres restent
identifiables et sélectionnables par leur contour, sans aplat coloré susceptible de détourner la
lecture. Le remplissage d'un point indique toujours son secteur. Son contour exprime exclusivement
le niveau canonique transmis par le Hub : vert/faible, orange/moyen, rouge/fort. La projection
visuelle regroupe `low` en faible, `medium` en moyen et `high|critical` en fort. Le niveau faible
reste fixe. Les niveaux moyen et fort ondulent avec la même couleur que leur contour ; l'orange moyen
est plus lent et discret, tandis que le rouge fort reste doux. Toute animation respecte
`prefers-reduced-motion` et ne constitue jamais une validation sanitaire.

Cette couleur ne doit jamais être calculée par le navigateur à partir de métriques brutes. Pour les
futurs connecteurs réels, chaque mapper institutionnel devra convertir les codes source vers la
gravité canonique au moyen d'une règle validée, versionnée et traçable. Une valeur absente ou
inconnue doit être rejetée ou placée en quarantaine pour revue, jamais classée silencieusement
« faible ». Le démonstrateur conserve ses niveaux simulés explicitement marqués.
