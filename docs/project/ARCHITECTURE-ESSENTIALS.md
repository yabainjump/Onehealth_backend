# Architecture Essentials — revue critique

**But :** conserver uniquement les décisions qui protègent le produit et obliger chaque revue à poser trois questions : qu’est-ce qui va casser, quels cas limites manquent, qu’avons-nous surconçu ?
**Dernière synchronisation :** 24 septembre 2026.

## 1. Les vingt-et-une décisions critiques

1. Deux frontends spécialisés partagent un backend NestJS commun.
2. Les domaines communauté et Hub utilisent deux bases MongoDB logiques séparées.
3. Le backend est l’unique autorité pour l’authentification, les rôles, les pays et la souveraineté.
4. Le Hub conserve séparément raw record, observation, événement, signal, alerte,
   rapport de simulation et rapport officiel.
5. Une corrélation est explicable et versionnée ; elle ne prouve jamais une causalité.
6. Une alerte et un rapport officiel exigent une validation humaine traçable.
7. Rudolf reçoit un contexte construit côté serveur et reste sans accès aux transitions.
8. Les 165 observations et 33 connecteurs sont simulés et doivent toujours être identifiés comme tels.
9. Le fallback local du Dashboard est un outil de démonstration, pas un mécanisme de production.
10. Le backend démarre avec exactement deux workers PM2, chacun promu seulement après readiness.
11. Le rapport de scénario est un instantané de démonstration attaché à la dernière
    exécution : il reste `simulated: true`, `official: false` et n’a aucune transition
    de validation ou publication.
12. Le modal d’exécution du scénario bloque les doubles soumissions et attend la
    réponse serveur ; son animation est seulement un état d’attente, jamais une
    preuve de progression ou de succès.
13. Jenkins valide le code sans recevoir le `.env`; Apache/cPanel termine TLS pendant le pilote.
14. Pas de microservices, Kafka, SQL/PostGIS ou moteur prédictif avant mesure d’un besoin réel.
15. La route `/` du Dashboard est une landing publique chargée paresseusement, sans resolver ni
    donnée Hub ; toute entrée dans l’espace opérationnel repasse par le garde d’authentification.
16. Le scénario de démonstration accepte exactement deux États CEEAC distincts et
    une période non future de 90 jours maximum. Le backend impose DHIS2, ARIS 3 et
    CAPC-AC, persiste la configuration et conserve la validation humaine.
17. Les documents produit et architecture sont versionnés dans
    `onehealth_backend/docs/project/`; le dossier racine n'est toujours pas un monorepo.
18. Aucun composant de carte ne connaît directement une URL de tuiles. Le fournisseur est validé,
    configurable au déploiement et désactivable sans perdre les couches CEEAC.
19. Le service public OpenStreetMap est un défaut de démonstration sans SLA, pas une dépendance
    institutionnelle garantie. Aucun proxy, préchargement massif ou cache non autorisé n'est ajouté.
20. Les contrats réseau Angular sont générés depuis
    `onehealth_backend/contracts/dashboard-api.openapi.yaml`; les modèles de vue restent locaux.
21. L'internationalisation utilise français, anglais, portugais et espagnol, avec français comme
    repli. La migration est progressive mais tout nouveau libellé partagé passe par le catalogue.

## 2. Ce qui risque de casser en premier

### Backend partagé

Une panne ou un déploiement défectueux affecte les deux produits. Deux workers, des sondes
`live/ready`, le drainage et le remplacement PM2 réduisent désormais la coupure liée à un processus.
Ils ne protègent pas contre la panne du serveur unique. Les métriques centralisées et l'alerte
opérateur restent à terminer avant de revendiquer une continuité complète. Le rollback Git/PM2 est
maintenant automatique sur échec du candidat, mais son exercice chronométré sur un environnement
jetable reste obligatoire.

### Deux bases sans transaction commune

L’utilisateur et ses rôles sont dans `onehealth`, les données Hub dans `onehealth_hub`. Une opération transversale peut réussir d’un côté et échouer de l’autre. Éviter les écritures distribuées synchrones ; utiliser identifiants stables, idempotence, audit et réparation.

### Coordination distribuée à prouver sur le serveur

Les adaptateurs auth, upload et Rudolf utilisent désormais les quotas MongoDB partagés et échouent
fermés en HTTP 503 si la coordination est indisponible. Les tests unitaires multi-instance passent.
Les opérations d'une conversation Rudolf utilisent aussi un bail MongoDB avec propriétaire,
expiration et collision `409 conversation_busy`; l'interruption ne persiste pas de réponse partielle.
L'exercice sur deux processus et des bases jetables reste obligatoire avant exposition réelle. Le
verrou `CLUSTER_SECURITY_READY=false` continue donc de bloquer un démarrage ou déploiement production
à deux workers jusque-là.

### Fallback simulé du Dashboard

Il peut transformer une panne API en démonstration apparemment saine. En institutionnel, `allowDemoFallback` doit être `false`, avec écran d’incident explicite et aucun mélange entre réel et simulé.

### Accès aux médias privés

Les pièces jointes de conversation étaient servies en statique, donc lisibles par toute personne
connaissant l'URL. Elles exigent désormais un lien signé à durée limitée, émis dans la réponse
destinée à un membre. Trois limites subsistent et doivent être connues :

- **les médias de profil et de publication restent publics** : les robots d'aperçu social et les
  visionneuses de documents externes en dépendent. Ce qui est publié reste donc récupérable par URL ;
- **un client déjà ouvert au moment du déploiement** détient des liens non signés qui renverront 403
  jusqu'au rechargement de la conversation. C'est attendu et se résorbe seul ;
- **le lien reste valide 7 jours par défaut**, y compris s'il est transmis hors de l'application. La
  durée est réglable et n'est pas un contrôle d'identité : elle borne l'exposition, elle ne
  l'annule pas.

Une réponse privée valide est explicitement non-cacheable. Le cache statique long est réservé aux
médias publics, afin qu'un navigateur ou un proxy ne conserve pas une pièce jointe après l'échéance
du lien signé.

Un chiffrement au repos des médias et un chiffrement de bout en bout des conversations restent hors
périmètre ; ils deviendront pertinents si des données médicales nominatives transitent réellement.

### Plafond de génération d'images par processus

Le service d'images borne les générations simultanées en mémoire de processus. Avec deux workers, le
plafond réel est donc le double de la valeur configurée, et chaque worker ignore l'autre. C'est une
protection de disponibilité locale, pas un quota d'ayant droit : elle n'autorise jamais un accès. Le
rendre partagé ajouterait un aller-retour MongoDB à chaque requête d'image, pour un gain nul en
confidentialité. Cette exception est bornée et consignée dans
`specs/002-media-access-hardening/plan.md` ; elle sera réexaminée lors du passage multi-hôte.

### Service worker et CSP

Une actualisation normale peut servir un ancien shell ou une ancienne CSP alors qu’un hard refresh semble fonctionner. Tester le cycle de mise à jour PWA, versionner les assets, nettoyer les caches obsolètes et autoriser seulement les domaines réellement nécessaires.

Les prototypes motion contenant HTML, JavaScript inline, shader ou CDN sont uniquement des sources
de design. Le runtime utilise un composant SVG/CSS local partagé par la landing et la connexion ;
les prototypes ne doivent pas être ajoutés aux assets publiés ni chargés dans une iframe.

Les deux frontends étant des dépôts indépendants, leurs copies du logo peuvent dériver. La source
graphique validée reste la paire PNG transparente du dépôt Ionic ; toute synchronisation vers le
Dashboard doit conserver le canal alpha, les chemins locaux et le favicon carré séparé, sans URL
inter-dépôt ni ressource distante.

### Stockage média local

Deux processus du même serveur partagent le même `UPLOADS_DIR` absolu, créé et contrôlé avant le
démarrage puis par readiness. Les médias
deviennent incohérents seulement lors d'un passage à plusieurs hôtes, d'un disque plein ou d'une
restauration partielle. Avant multi-hôte : stockage objet, quotas, antivirus si requis, sauvegarde et
suppression orpheline.

En production, `/home/yabain/apps/onehealth-data/uploads` est l'unique source de vérité média et reste
hors de tous les dépôts. Un déploiement ne doit jamais le vider, le remplacer, le resynchroniser depuis
le worktree ou le traiter comme un artefact de build. MongoDB ne contient que les références : la
disponibilité, les permissions, la sauvegarde et la restauration de ce dossier doivent donc être
contrôlées séparément du code.

La seule exception est une récupération manuelle et tracée depuis une source connue ou une sauvegarde :
simulation préalable, copie des seuls fichiers absents, conservation de la source et contrôle HTTP.
Cette opération reste extérieure au déploiement.

### Jenkins, Apache et le Nginx inactif du serveur cPanel

Apache/cPanel possède les ports 80/443 ; Nginx 1.14.1 est installé mais arrêté. Il ne doit pas être
démarré pendant le pilote. Le serveur dispose de 8 CPU, 31 Gio de RAM et 1,6 Tio libre : Jenkins et
deux workers sont supportables, sous réserve de mesurer leur consommation réelle. Jenkins reste lié
à localhost ou derrière un domaine TLS protégé.

### Carte publique

Les tuiles OpenStreetMap publiques peuvent être lentes, limitées ou incompatibles avec un trafic
institutionnel. `MapTileLayerService` centralise désormais le choix `openstreetmap|custom|none`,
valide HTTPS, gabarit, zoom et attribution, puis laisse les frontières et signaux fonctionner sur
fond neutre en mode `none`. Le défaut OSM reste réservé au démonstrateur ; la production
institutionnelle doit fournir un service conforme avec engagement adapté.

Le Dashboard affiche individuellement les 165 observations du démonstrateur. Ce choix ne remplace
pas une API spatiale paginée par `bbox`, ni un clustering serveur si le volume devient institutionnel.
La frise temporelle et la plage `du/au` filtrent les observations autorisées ; les liaisons affichées
doivent provenir d’un événement Hub consolidé et ne prouvent jamais une causalité.

Décision UX : toutes les cartes conservent Leaflet, l'attribution du fournisseur et les données
existantes. Un fond opérationnel atténué, des contrôles compacts et une hauteur réellement utile
améliorent la lecture. Une couleur décrit un secteur, une taille ou un anneau décrit un statut déjà
connu ; l'animation n'invente jamais une urgence. Les popups ne doivent jamais injecter du HTML issu
d'un utilisateur. Toute montée en volume devra passer à une requête spatiale `bbox` et ne pas charger
l'ensemble du registre dans le navigateur.

Le Dashboard rend les observations ordinaires sur un Canvas commun et garde le SVG uniquement pour
les animations des éléments qualifiés. Les tuiles contournent explicitement le service worker et la
marge mémoire Leaflet est bornée. Cela améliore le rendu client mais ne corrige ni la latence du
service public OpenStreetMap ni sa politique d'usage : un fournisseur institutionnel ou des tuiles
hébergées selon les licences reste nécessaire avant une charge importante.

Les onze contours CEEAC viennent d'un extrait local Natural Earth 1:50m, placé sous les signaux. Ils
sont indicatifs, non une référence frontalière officielle. Le hover ne doit jamais augmenter
l'opacité au point de cacher un marqueur et sa fiche ne calcule que les observations déjà autorisées
et visibles dans le filtre courant.

Les pays utilisent une palette territoriale stable et non sémantique, avec une paire contour/aplat
propre à chacun des onze codes CEEAC selon la référence graphique fournie par le propriétaire. Cette
couleur identifie seulement le territoire et ne doit jamais être lue comme une gravité sanitaire.
Le clic filtre le pays, mais une commande HTML accessible doit fournir la même action. Les valeurs
API ne sont jamais injectées comme HTML dans les infobulles. Ne pas copier le code GPL du projet
cartographique utilisé comme référence visuelle.

Le plein écran cartographique doit toujours agrandir le conteneur Leaflet existant, jamais cloner
la carte ni relancer le chargement des données. Le contrôle doit conserver une sortie accessible
par bouton et `Échap`, nettoyer tout verrouillage du `body` à sa destruction et provoquer le
recalcul de taille Leaflet après entrée ou sortie. L'API native est privilégiée; un repli CSS borné
au viewport couvre les navigateurs mobiles incompatibles sans changer les droits ni les périmètres
de données.

La gravité sanitaire reste une donnée canonique produite côté serveur, jamais une déduction du
navigateur. La carte ne fait qu'une projection à trois couleurs : vert `low`, orange `medium`, rouge
doux `high|critical`. Le faible reste fixe ; les niveaux moyen et fort ondulent, avec un rythme plus
lent et discret pour le moyen, et toutes les animations respectent `prefers-reduced-motion`. Une
gravité absente ou inconnue ne doit pas devenir `low` par défaut : les futurs
connecteurs doivent rejeter ou mettre la donnée en quarantaine et tracer la version de la règle de
mapping. La couleur est un indicateur de triage, pas une validation d'alerte. En focus pays, seul le
pays sélectionné conserve un remplissage ; les autres contours restent visibles et interactifs.

### Taille du contexte IA

Envoyer trop d’observations augmente coût, latence et risque d’instructions malveillantes dans les données. Résumer côté serveur, limiter les champs, plafonner le nombre d’éléments et exposer les IDs utilisés.

## 3. Cas limites manquants ou à renforcer

### Données et temps

- observation reçue tardivement mais datée avant un événement déjà clos ;
- horodatages sans fuseau, heure d’été ou formats nationaux divergents ;
- même événement avec identifiants sources différents ;
- source qui corrige ou supprime un enregistrement après ingestion ;
- métrique dont l’unité change ou est absente ;
- zone administrative renommée ou code pays invalide ;
- coordonnées `0,0`, inversées ou situées hors du pays déclaré ;
- point proche d’une frontière réellement pertinent pour deux pays ;
- doublon presque identique mais pas strictement égal ;
- signal déjà assigné lorsque deux vérificateurs cliquent simultanément.

### Souveraineté

- droit révoqué pendant qu’un utilisateur consulte un dossier ;
- politique modifiée après génération d’un rapport ;
- événement multi-pays dont une observation devient interdite ;
- export téléchargé avant révocation ;
- administrateur régional sans pays explicite ;
- utilisateur ayant plusieurs rôles contradictoires ;
- conservation expirée pour une donnée encore référencée par un rapport.

### Authentification et comptes

- liaison Google avec un email déjà existant ;
- photo Google inaccessible et ancien lien Firebase ;
- compte banni avec JWT encore valide ;
- changement de rôle pendant une session ;
- reset demandé plusieurs fois ou token utilisé deux fois ;
- mot de passe admin perdu : réinitialiser, ne jamais chercher à le révéler.

### IA

- prompt injection dans `title`, `summary` ou payload source ;
- réponse incomplète, timeout, quota Groq ou modèle retiré ;
- réponse contenant HTML/Markdown hostile ;
- affirmation de causalité malgré les consignes ;
- contexte vide ou exclusivement mono-sectoriel ;
- sortie générée avec des données dont le partage est ensuite révoqué ;
- utilisateur qui demande une validation ou une communication officielle.

### UX et réseau

- mobile étroit, textes longs et boutons traduits ;
- connexion lente/interrompue pendant upload ou streaming ;
- ouverture d’une route profonde après déploiement ;
- navigateur avec ancien service worker ;
- carte indisponible mais liste encore utilisable ;
- état vide distinct de l’erreur API ;
- double clic créant une action en double.
- utilisateur multi-pays ouvrant la vue nationale sans pays encore sélectionné ;
- profil ancien dont les champs optionnels ou la photo distante sont absents ;
- mise à jour du profil interrompue : ne jamais modifier localement les rôles ou pays administrés.

## 4. Ce qui serait surconçu aujourd’hui

### Microservices

Le volume réel n’est pas connu. Séparer auth, Hub, IA et médias maintenant multiplierait déploiements, observabilité et erreurs distribuées. Commencer par des frontières de modules strictes et mesurer.

### Kafka ou bus événementiel complexe

Le seed et les connecteurs simulés ne justifient pas une plateforme événementielle. Une file Redis/BullMQ suffit d’abord pour tâches lentes, médias ou synchronisations.

### Migration SQL générale

MongoDB répond au MVP. PostGIS devient pertinent si les requêtes géospatiales, jointures analytiques ou contraintes institutionnelles le démontrent. Ne pas convertir continuellement toutes les données vers SQL sans architecture de migration validée.

### Moteur générique de règles

La règle actuelle est versionnée et testable dans le code. Une interface de règles administrable trop tôt peut masquer des règles non validées et compliquer l’audit. Ajouter un registre de règles seulement quand plusieurs règles officielles existent.

### IA autonome ou prédictive

Le besoin actuel est la synthèse assistée. Ne pas produire de diagnostic, score opaque, déclenchement automatique ou publication sans données validées, étude de biais et gouvernance.

### Duplication du canal sentinelle

Ne pas recopier automatiquement les alertes communautaires dans le Hub. D’abord dédupliquer, qualifier la confiance, vérifier la base juridique et déterminer si la même information existe déjà dans DHIS2/ARIS/CAPC-AC.

## 5. Questions obligatoires avant une modification

1. Quel utilisateur et quelle décision métier cette modification sert-elle ?
2. Est-ce une fonction communautaire, Hub ou partagée ?
3. Quelle donnée entre, où est-elle stockée et qui peut la voir ?
4. Peut-elle créer un doublon, une fuite entre pays ou une transition invalide ?
5. Que se passe-t-il si le réseau, MongoDB, Groq, SMTP ou la carte échoue ?
6. Comment distingue-t-on vide, erreur, simulé et réel ?
7. Le frontend essaie-t-il de faire respecter une règle qui doit être serveur ?
8. Quelle trace d’audit faut-il garder sans journaliser de secret ?
9. Quel est le test minimal prouvant la sécurité et la régression ?
10. Peut-on résoudre le besoin dans le monolithe modulaire avant d’ajouter une infrastructure ?

## 6. Barrières de mise en production institutionnelle

Lot local `003-bounded-client-load` (14–15 septembre 2026) : polling inactif supprimé,
lecture groupée des participants, requêtes Hub bornées, sessions obsolètes invalidées.
Aucun cache global privé ni affaiblissement des gardes, quotas, CSP ou CORS.
Le Hub charge encore tout le périmètre jusqu'au plafond explicite 10 000 observations :
au-delà, refus et non troncature. Prévoir résumés serveur et pagination bbox/par écran.
Les 165 observations fictives ne constituent pas un benchmark ; mesurer p95, erreurs,
CPU, mémoire et MongoDB en préproduction avant de revendiquer 1 000 utilisateurs.

- accords de partage et responsabilités signés ;
- connecteurs réels testés et secrets gérés ;
- provenance et coordonnées officiellement validées ;
- fallback simulé désactivé ;
- sauvegarde/restauration prouvée ;
- monitoring, alerting et journalisation opérationnels ;
- rate limiting distribué et quotas définis ;
- pentest, charge et revue juridique terminés ;
- règles et workflow approuvés par les autorités ;
- tests adversariaux IA et validation de l’hébergement des données ;
- procédure de révocation, incident et retour arrière documentée.

## 7. Pagination du registre — lot 004 (15 septembre 2026)

- /hub/observations conserve JWT/HubAccessGuard et scope pays avant tout traitement.
  Vue whitelistée all/priority/country ; priority intersecte le stage, sans l'écraser.
- Une page de 8 dans le registre, max API 100 lignes et 1 000 pages. Totaux serveur,
  export explicitement de la page ; plafond de navigation affiché au-delà de 8 000.
- Résumé par une agrégation scoped au lieu de huit requêtes ; délai Mongo 5 s.
- Resolver complet déplacé du shell aux six vues qui en dépendent. Les autres
  n'attendent plus l'ensemble des observations.
- Risques restants : pagination offset non snapshot, recherche littérale non indexée,
  tri par pays binaire Mongo (pas collation française), agrégats/cartographie encore
  à migrer. Plans explain et index de préproduction à mesurer, pas d'index ajouté à l'aveugle.
- Ne pas considérer un sous-domaine sur les workers/bases production comme une
  préproduction isolée. Deux workers ne constituent pas une preuve de capacité.
  Pas de Redis, SQL, nouveau port ou changement média pour ce lot.
