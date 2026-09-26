# Architecture — One Health Network

**Version :** 1.8  
**Synchronisation code :** 26 septembre 2026 (OpenRouter ; fondations Dashboard du 24 septembre)
**Révisions inspectées :** backend `f5d2e87` + invariant de stockage persistant en cours, dashboard `131e961` + identité visuelle locale, frontend `f1a6906`  
**Document détaillé historique du Hub :** `../DECISIONS_ARCHITECTURE_ET_PLAN_MVP_HUB_CEEAC.md`  
**Versionnement :** document canonique suivi dans `onehealth_backend/docs/project/`

## 1. Vue d’ensemble

```text
Utilisateurs communautaires                Acteurs institutionnels CEEAC
              │                                         │
              ▼                                         ▼
┌──────────────────────────────┐       ┌──────────────────────────────┐
│ onehealth_frontend           │       │ onehealth_dashboard          │
│ Ionic / Angular / PWA        │       │ Angular / Leaflet            │
│ communauté, alertes, chat, IA│       │ décision, carte, rapports, IA│
└───────────────┬──────────────┘       └───────────────┬──────────────┘
                └──────────────────┬───────────────────┘
                                   ▼
                    ┌──────────────────────────────┐
                    │ Apache/cPanel : TLS / proxy  │
                    └──────────────┬───────────────┘
                                   ▼
                    ┌──────────────────────────────┐
                    │ PM2 cluster : 2 workers      │
                    │ NestJS REST / JWT / OpenRouter│
                    └──────┬──────────┬────────────┘
                           │          │
             ┌─────────────▼──┐   ┌───▼────────────────┐
             │ Mongo onehealth│   │ Mongo onehealth_hub│
             │ communauté    │   │ données régionales │
             └────────────────┘   └────────────────────┘
```

Le backend est partagé, mais les deux frontends ont des objectifs et cycles d’usage distincts. Le Hub utilise une connexion MongoDB nommée `hub` et une base logique séparée, ce qui limite le mélange entre données communautaires et institutionnelles sans imposer un second service backend.

## 2. Dépôts et responsabilités

```text
One_health2/
├── onehealth_frontend/       application communautaire Ionic
├── onehealth_dashboard/      interface institutionnelle Angular
├── onehealth_backend/        API NestJS, contrats, docs et workers/services actuels
├── DECISIONS_ARCHITECTURE_ET_PLAN_MVP_HUB_CEEAC.md
└── RAPPORT_CEEAC_ONE_HEALTH_NETWORK.md
```

| Dépôt | Responsabilité | Ne doit pas contenir |
|---|---|---|
| `onehealth_frontend` | présentation et interactions communautaires | secret, règle d’autorisation faisant foi, clé OpenRouter |
| `onehealth_dashboard` | présentation et interactions Hub | accès direct MongoDB, décision métier uniquement client |
| `onehealth_backend` | règles, autorisations, persistance et intégrations | logique visuelle spécifique à un écran |

## 3. Technologies

| Couche | Technologies actuelles |
|---|---|
| Communauté | Angular 20, Ionic 8, Capacitor 8, PWA, Leaflet |
| Dashboard | Angular 20 standalone, signals, Lucide, Leaflet |
| Backend | Node.js 20, NestJS 11, Mongoose 9, REST, Swagger conditionnel |
| Authentification | JWT, bcrypt, Google Identity Services côté client + vérification serveur |
| IA | SDK OpenAI 6.x compatible Node 20 vers API OpenRouter, modèle configurable, prompts Rudolf spécialisés |
| Email | Nodemailer/SMTP |
| Images | Sharp, stockage local géré et anciennes URL Firebase compatibles |
| Production cible du pilote | Jenkins CI/CD, Apache/cPanel TLS/reverse proxy, PM2 à deux workers |
| Nginx installé | Version 1.14.1 inactive, conservée sans activation pendant le pilote |

### 3.1. Fondations du Dashboard versionnées le 24 septembre 2026

- la documentation transversale vit dans le dépôt backend sous `docs/project/`, car le dossier
  parent contient trois dépôts indépendants et n'est pas lui-même versionné ;
- le contrat REST consommé par Angular est `contracts/dashboard-api.openapi.yaml`. La commande
  `npm run api:generate` produit `core/api/generated/dashboard-api.types.ts` et `api:check` détecte
  toute dérive. Le fichier généré n'est jamais édité manuellement ;
- `MapTileLayerService` centralise le fond Leaflet. `openstreetmap` demeure un mode démonstrateur,
  `custom` exige HTTPS, `{z}/{x}/{y}` et une attribution, `none` garde frontières et signaux sur un
  fond neutre. Les pages ne contiennent plus d'URL de tuiles. Pendant la transition, un ancien
  `environment.ts` généré sans bloc `mapTiles` reste compatible et sélectionne le fournisseur de
  démonstration par défaut ;
- le dialogue d'exécution du scénario est un composant présentatif autonome. La page Dashboard
  conserve appels API, validation métier et transitions ; le composant gère rendu, focus et scroll ;
- `I18nService`, le pipe `t` et le sélecteur de langue fournissent FR/EN/PT/ES, stockent seulement
  une préférence non sensible dans `localStorage` et replient sur le français. Le shell et le
  scénario sont migrés en premier, les pages métier le seront par lots testés.

FFmpeg est seulement une dépendance optionnelle ; aucun flux produit critique ne doit encore en dépendre.

## 4. Backend NestJS

### 4.1. Modules

```text
src/
├── auth/             inscription, login, Google, reset, JWT
├── users/            profils, follow, rôles et portée Hub
├── posts/            publications, médias, likes, commentaires
├── chat/             salons privés, messages, état de lecture
├── alerts/           alertes communautaires
├── notifications/    notifications utilisateur
├── certifications/   demandes de certification
├── admin/            modération et attribution des accès Hub
├── upload/           validation et stockage des médias
├── media/            miniatures, posters et images sociales
├── share/            pages sociales, métadonnées et sitemap
├── rudolf/           conversations et fournisseur OpenRouter
├── hub/              ingestion, souveraineté, analyse et workflow CEEAC
├── mail/              courriels transactionnels
├── health/            sondes publique live/ready
├── runtime/           readiness continue, drainage et remplacement PM2
├── coordination/      quotas et baux partagés MongoDB
├── media-access/      signature des médias privés (module global)
├── observability/     contexte de requête (squelette, intégration suivante)
└── config/            environnement, Swagger, chemins
```

La convention cible est : `controller → service → repository/model`. Les contrôleurs valident et autorisent, les services portent le métier, les repositories isolent les requêtes complexes.

### 4.2. Configuration HTTP

- préfixe global : `/api` ;
- `ValidationPipe` global avec `whitelist`, `forbidNonWhitelisted` et transformation ;
- CORS par liste explicite ; une production sans origine configurée refuse de démarrer ;
- `Cache-Control: no-store` par défaut sur l’API dynamique ;
- HSTS en production, `nosniff`, `DENY` et politique de référent ;
- Swagger activable par environnement et normalement désactivé publiquement ;
- fichiers uploadés servis sous `/uploads/`, scripts/HTML/SVG forcés en téléchargement ;
- `/uploads/message/` n'est **pas** public : une barrière placée avant le service statique exige une
  autorisation signée (HMAC-SHA256 liant le chemin et son échéance), émise par le serveur dans la
  réponse de conversation destinée à un membre. `/uploads/profile/` et `/uploads/post/` restent
  publics, car les robots d'aperçu social et les visionneuses de documents externes en dépendent.
  Une réponse privée porte `Cache-Control: private, no-store, max-age=0`, tandis que le cache statique
  de 30 jours reste limité aux médias publics. Un chemin mal encodé est refusé en HTTP 400 ;
- `/uploads/certification/` suit la même barrière de lecture, mais l'accès est émis
  seulement dans la réponse au demandeur ou à un administrateur. `POST /api/upload/certification`
  stocke le document dans cet espace séparé. L'envoi d'un message ou d'une demande de
  certification exige une preuve HMAC de téléversement liée au compte : la signature
  de lecture seule n'autorise pas une nouvelle publication. La preuve est ôtée avant
  persistance. L'ancien client de certification utilisant `/upload/post` ne peut plus
  soumettre tant qu'il n'a pas reçu le nouveau frontend ; déployer les deux de façon
  rapprochée ;
- `/api/media/*` refuse les chemins privés : ce service lit le disque directement et renverrait
  sinon une copie redimensionnée d'un contenu protégé.
- Les anciens justificatifs `post` sont migrés séparément, avec inventaire, sauvegarde,
  détection des références publiques partagées et retrait de la source seulement si
  elle n'est pas utilisée ailleurs. Le déploiement normal ne déclenche jamais cette
  migration et ne touche jamais le dossier persistant hors dépôt.
- `/api/health/live` indique que le processus répond ; `/api/health/ready` exige les deux connexions
  MongoDB et le stockage média ; `/api/health` reste compatible ;
- un worker non prêt refuse les nouvelles routes applicatives avec HTTP 503, draine les requêtes en
  cours pendant une durée bornée, puis demande son remplacement à PM2 ;
- PM2 n'annonce un worker `online` qu'après le signal applicatif `ready`.
- en production, `UPLOADS_DIR=/home/yabain/apps/onehealth-data/uploads` est le chemin absolu commun
  aux deux workers et l'unique source de vérité des médias. Il est volontairement situé hors du dépôt
  applicatif pour survivre aux `git reset`, builds, rollbacks et déploiements. Le backend peut créer
  les sous-dossiers et vérifier leur accès avant le trafic, mais aucun script de déploiement ne doit
  nettoyer, remplacer, recopier depuis le dépôt ou supprimer ce stockage. Sa sauvegarde et sa
  restauration suivent un cycle indépendant de Git. Une récupération exceptionnelle depuis un ancien
  dossier exige un aperçu en lecture seule, une copie limitée aux fichiers absents, aucune suppression
  de la source et une vérification HTTP après copie ; elle ne fait jamais partie du pipeline CI/CD.

### 4.3. Bases MongoDB

#### Base communautaire `onehealth`

| Collection | Responsabilité |
|---|---|
| `users` | compte, profil, Google, certification, rôles et pays Hub, date du dernier changement de mot de passe |
| `posts` | publication, pièces jointes, likes et commentaires |
| `alerts` | signalements communautaires et vérification administrative |
| `chat_rooms` | participants et état d’un salon privé |
| `chat_messages` | messages et pièces jointes |
| `notifications` | événements destinés à un utilisateur |
| `certification_requests` | workflow de certification |
| `rudolf_conversations` | historique privé de Rudolf par utilisateur |

#### Base Hub `onehealth_hub`

| Collection | Responsabilité | Identité/contrainte principale |
|---|---|---|
| `hub_raw_records` | payload d’origine | source + instance + pays + ID source |
| `hub_observations` | modèle canonique | `canonicalId`, index `2dsphere` |
| `hub_events` | rapprochement explicable | `eventCode` déterministe |
| `hub_signals` | élément à vérifier | signal/observation uniques |
| `hub_alerts` | signal humainement vérifié | alerte/signal/observation uniques |
| `hub_alert_reports` | versions de rapport | alerte + version uniques |
| `hub_sharing_policies` | souveraineté | `policyId` |
| `hub_connectors` | configuration non secrète et état | pays + source uniques |
| `hub_ingestion_runs` | exécutions de connecteur | connecteur + date |
| `hub_scenario_runs` | scénario dynamique et instantané de rapport simulé | `scenarioCode` |
| `hub_audit_logs` | piste d’audit | entité + ID + date |

Les deux bases ne partagent pas de transaction MongoDB. Les actions qui traversent les deux domaines doivent donc être idempotentes, réparables et auditées.

## 5. Modèle Hub et transitions

```text
Source autorisée
      ↓
RawRecord ── normalisation/déduplication ──► Observation
                                                  │
                            rapprochement explicable entre observations
                                                  ▼
                                                Event
                                                  │
                                      règle de détection versionnée
                                                  ▼
                                                Signal
                                     assignation + décision humaine
                                      ├───────────┴───────────┐
                                      ▼                       ▼
                                  Rejected              Verified Alert
                                                               │
                                                               ▼
                                                  Report versionné et audité
```

Une observation n’est pas une alerte. Un événement est un regroupement analytique, pas une preuve de causalité. Rudolf n’accède à aucune méthode de transition.

## 6. Sources et normalisation

| Secteur | Système simulé | Format cible réel possible |
|---|---|---|
| santé humaine | DHIS2 | REST/JSON autorisé par l’instance nationale |
| santé animale | ARIS 3 | API/export validé avec AU-IBAR/institution |
| environnement | CAPC-AC/stations météo | API, GeoJSON, CSV ou flux convenu |

Le démonstrateur contient 165 enregistrements bruts et 165 observations : 11 pays × 3 sources × 5 observations. Les 33 connecteurs sont fictifs. Les futurs connecteurs réels doivent produire le même modèle canonique et conserver le payload brut, le mapping, la date de réception et les rejets.

## 7. Authentification, rôles et souveraineté

### 7.1. Rôles

```text
Application : user | admin
Hub         : hub_viewer | hub_analyst | hub_verifier | hub_admin
Portée      : hubCountryCodes[]
```

- `admin` global et `hub_admin` ont une portée régionale ;
- un autre rôle Hub doit être limité aux pays attribués ;
- la portée effective est calculée serveur ;
- un filtre du frontend ne peut jamais élargir cette portée ;
- seul un administrateur global attribue les rôles/pays Hub ;
- les politiques de souveraineté complètent les rôles par propriétaire, niveau de partage, agrégation, rétention et destinataires.

### 7.1 bis. Sessions et quotas d'authentification

- une réinitialisation de mot de passe horodate le compte : toute session émise avant cette date est
  refusée à sa requête suivante, y compris un jeton dérobé encore dans sa durée de validité ;
- la vérification du bannissement et de la date de changement, puis la mise à jour de présence,
  forment une écriture MongoDB conditionnelle atomique : une session refusée ne rend jamais le compte
  « en ligne » ;
- un jeton sans date d'émission est refusé dès qu'un changement de mot de passe est enregistré ;
- les quotas d'authentification restent par adresse cliente, complétés par un comptage **par compte
  visé** (`auth-login-account`, 20 échecs / 15 minutes) sur l'état partagé MongoDB. Seuls les échecs
  sont comptés : un mot de passe correct passe toujours, ce qui interdit à un tiers de verrouiller le
  compte d'autrui ;
- la clé de quota d'une route est normalisée (casse, barres obliques redondantes, segments neutres) :
  `/api/AUTH/LOGIN` et `/api/auth/login/` alimentent le même compteur que la forme canonique.

### 7.2. Gardes Hub

- `JwtAuthGuard` : identité ;
- `HubAccessGuard` : accès minimal ;
- `HubAnalystGuard` : consolidation, rapports et IA ;
- `HubVerifierGuard` : assignation et décision ;
- `HubAdminGuard` : connecteurs, souveraineté et scénario ;
- `AdminGuard` : administration globale et seed protégé.

## 8. Interfaces frontend

### 8.1. Application communautaire

Routes principales : accueil public, login/register/reset, fil `/tabs/dashbord`, messages `/tabs/home`, alertes `/tabs/alerts`, notifications, profils, publication, certification et administration.

Les formulaires email/mot de passe, y compris l'ancienne route publique `/register2`,
n'écrivent jamais leurs valeurs, réponses ou erreurs dans la console du navigateur.

Rudolf se trouve dans Messages → Rudolf IA. Les conversations privées sont persistées côté backend et les réponses sont diffusées en NDJSON progressif.

Le service worker Angular peut conserver une ancienne version : toute modification de CSP, de médias ou de ressources externes doit être testée avec mise à jour PWA et rechargement normal, pas seulement avec `Ctrl+Shift+R`. Les galeries demandent d'abord une miniature backend, retombent une seule fois sur le fichier original et affichent ensuite un état « Image indisponible » sans boucle ni image native cassée.

### 8.2. Dashboard CEEAC

La route `/` est une landing publique statique et ne déclenche ni resolver Hub ni chargement de
données institutionnelles. Ses appels à l'action ciblent `/dashboard`, dont le garde restaure la
session ou redirige vers `/connexion`. Les animations de révélation utilisent `IntersectionObserver`,
les effets continus restent CSS, et `prefers-reduced-motion` neutralise les mouvements. Le composant
reste chargé à la demande ; son budget de style explicite est borné à 32 Ko, avec avertissement à
30 Ko. Le lot produit de la landing reste contrôlé séparément par le build de production.

`ConvergenceMotionComponent` porte le radar animé commun à la landing et à la connexion. Il utilise
uniquement SVG et CSS locaux, sans script inline, iframe, WebGL permanent ni CDN. Les prototypes
`src/assets/animated_svg`, `src/assets/shader` et `src/assets/three.js` restent des références de
design : ils ne sont pas déclarés dans les assets du build Angular et ne sont donc ni exécutés ni
publiés. Cette séparation conserve la CSP, limite le coût GPU et permet à `prefers-reduced-motion`
de neutraliser toutes les animations décoratives.

Les logos transparents restent versionnés séparément dans chaque frontend afin qu'aucun runtime ne
dépende de l'autre dépôt. Le Dashboard embarque `public/assets/brand/one-health-network-web.png`
pour les marques compactes et loaders, et `one-health-network.png` pour le cœur plus détaillé de
l'animation de convergence. Ces copies proviennent des variantes sans fond du dépôt Ionic ; le
favicon carré reste un actif distinct pour préserver son ratio dans les navigateurs.

La typographie du Dashboard repose sur une seule famille, `Inter Variable`, auto-hébergée par le
bundle Angular via `@fontsource-variable/inter`. Aucun appel Google Fonts n'est nécessaire, ce qui
préserve la CSP et évite qu'une police distante bloque le premier rendu. Les jetons globaux fixent
les labels à 12–13 px, le texte courant à 14–16 px, les titres de section à 18–22 px, les titres de
page à 24–30 px et les KPI à 28–40 px. La police monospace reste réservée aux identifiants de trace
et autres données techniques.

Routes protégées : `/dashboard`, `/etat-membre`, `/carte`, `/alertes`, `/alertes/:id`, `/analyses`, `/rapports`, `/connecteurs`, `/souverainete`, `/administration`, `/aide` et `/profil`.

`/etat-membre` n'élargit jamais la portée : la page agrège uniquement les observations déjà filtrées par l'API pour l'utilisateur connecté. `/profil` persiste les champs personnels via `PATCH /api/users/me`; les rôles Hub et codes pays y restent en lecture seule et sont administrés séparément. `/aide` est une base contextuelle locale sans donnée sensible ni dépendance externe.

Le Dashboard charge l’API en priorité. Le fallback local simulé est utile en démonstration mais doit être désactivé dans une production institutionnelle, sinon il peut masquer une panne ou une erreur de données.

La déconnexion est locale d'abord : identité, jeton et données Hub sont purgés
synchroniquement, puis le shell protégé entier est démonté et la navigation vers
`/connexion` démarre sans attendre la requête de révocation (meilleur effort, délai
borné). Les instantanés locaux des rapports et les réponses Rudolf disparaissent donc
immédiatement de l'écran, même si le réseau est lent. La réponse tardive d'une ancienne
révocation ne doit jamais effacer une nouvelle session.

Le démarrage du Dashboard conserve l’ordre sécurisé `restauration de session → périmètre Hub →
observations`. Un écran de chargement statique est présent avant l’amorçage Angular, puis un loader
de marque réutilisable couvre la navigation et les modules qui attendent réellement l’API. Les
composants de routes paresseuses sont préchargés après la première navigation afin d’accélérer les
pages suivantes sans retarder la validation initiale de la session.

La carte régionale conserve les observations sous forme de petits points individuels, anime
les niveaux moyen et fort avec respect de `prefers-reduced-motion`, et permet une
lecture temporelle des observations déjà autorisées. Les raccourcis temporels sont complétés par
une plage personnalisée inclusive `du/au`. Les liaisons intersectorielles sont dessinées
exclusivement depuis les événements consolidés retournés par `/api/hub/events` : aucune proximité
visuelle calculée dans le navigateur ne doit être présentée comme une corrélation, encore moins
comme une causalité.

Le langage visuel cartographique est partagé par le Hub Angular et l'application Ionic : Leaflet et
OpenStreetMap sont conservés, le fond est atténué pour ne pas concurrencer les données, les couleurs
identifient le secteur et la taille qualifie uniquement un niveau réellement présent dans la donnée.
Sur la carte régionale, les pulsations indiquent les niveaux moyen et fort ; le faible reste fixe.
Les cartes communautaires conservent leurs règles de qualification propres. Les popups communautaires
sont créées avec des nœuds DOM et `textContent` (jamais avec du HTML utilisateur), puis exposent
seulement le titre, le lieu, la catégorie, la gravité et le statut disponibles. Les cartes de saisie,
de détail, de liste et d'aperçu réemploient les mêmes options de tuiles, sans recréer de dépendance ni
modifier les contrats API. Le clustering reste limité à la carte communautaire qui le possédait déjà.

Pour limiter le délai d'affichage du Dashboard, les URLs de tuiles utilisent le domaine canonique
OpenStreetMap avec `ngsw-bypass` afin d'éviter l'interception par le service worker. Seule une petite
marge de tuiles reste en mémoire et aucun nouveau lot n'est chargé pendant une animation de zoom.
Les marqueurs principaux partagent un renderer Canvas ; seuls les anneaux des niveaux moyen et fort
restent en SVG. Les 165 observations restent donc disponibles sans créer 165 marqueurs SVG. Le loader
cartographique disparaît sur l'événement Leaflet `load` et possède un délai de secours de six secondes
pour ne jamais bloquer l'interface si un serveur de tuiles répond partiellement.

Les contours des onze États membres sont fournis par un GeoJSON statique de 60 Ko extrait de Natural
Earth Admin 0 à l'échelle 1:50m. La couche réside dans un pane Leaflet de niveau 350, sous les
observations et signaux. Le survol augmente temporairement l'opacité sans masquer les points et
construit avec `textContent` une fiche calculée depuis les observations actuellement visibles. Ces
contours servent à la visualisation et ne constituent pas une position juridique sur les frontières.

La géométrie des pays ne porte plus de couleur de risque. `CEEAC_TERRITORY_COLORS` associe aux onze
codes ISO une paire `fill/stroke` inspirée de la référence graphique fournie : jaune pâle pour le
Tchad, pêche pour le Cameroun, menthe pour la RCA, orange pour la Guinée équatoriale, bleu clair pour
le Gabon, vert clair pour le Congo, vert soutenu pour la RDC, crème pour le Rwanda, lilas pour le
Burundi, vert doux pour São Tomé-et-Príncipe et rose désaturé pour l'Angola. Un repli gris-bleu couvre
un éventuel code inconnu. La fiche de survol conserve le niveau textuel calculé, les secteurs présents
et la date de la donnée la plus récente. Un clic sur le polygone active le filtre pays ; le même
filtre reste disponible dans un `select` accessible et peut être retiré depuis le résumé de carte.

Le modèle d'empilement Leaflet (frontières sous les marqueurs, infobulles assainies, coloration au
survol) a été réimplémenté dans le code Angular du Dashboard. Aucun code ni actif du projet de
référence GPL-2.0 `FottyM/ebola-tracker` n'est incorporé.

Le Dashboard et l'application Ionic possèdent chacun leur composant autonome
`MapFullscreenControlComponent`, conformément à leur séparation en dépôts indépendants. Le contrôle
cible le conteneur Leaflet déjà monté : API Fullscreen native, compatibilité WebKit, puis repli CSS
fixe au viewport si l'API est indisponible ou refusée. Il synchronise son état sur
`fullscreenchange`, gère la sortie par `Échap`, verrouille le défilement du document uniquement
pendant le repli et émet deux événements `resize` après la transition pour laisser Leaflet
recalculer ses dimensions. Aucune donnée, requête API ou règle d'autorisation n'est modifiée.

Le Dashboard centralise la projection de gravité dans `shared/utils/observation-risk.util.ts`.
L'API continue d'exposer la gravité canonique `low|medium|high|critical`; la carte la projette sans
perte de contrat en trois niveaux de lecture issus du design system : `low → low` (vert `#2E7D32`),
`medium → medium` (orange `#ED6C02`), `high|critical → high` (rouge doux `#E57373`). Le remplissage
du marqueur demeure sectoriel. Le contour et le tooltip emploient le niveau projeté. Le faible reste
fixe ; le moyen pulse lentement toutes les `3,2 s` avec une opacité réduite, et le fort toutes les
`2,35 s` avec le rouge doux. L'aperçu régional réutilise la même palette. Les aplats territoriaux n'utilisent jamais
ces couleurs sémantiques.

La couche GeoJSON reçoit aussi l'état global de sélection. Sans sélection, les onze pays conservent
leur remplissage territorial translucide. Avec une sélection, le pays actif seul garde son aplat ; les
autres passent à `fillOpacity: 0`, y compris au survol, mais leur bordure et leur interaction restent
actives. Cette règle évite de masquer les points et permet de changer directement de pays.

État actuel : les observations de démonstration possèdent déjà une gravité explicite, attribuée par
la fabrique de seed backend. Cible du pilote réel : le mapper de chaque connecteur transforme une
valeur source validée vers la gravité canonique et conserve l'identifiant/version de règle avec la
provenance. Une valeur inconnue suit le circuit de rejet/quarantaine ; elle ne profite pas de la
valeur MongoDB par défaut. Cette normalisation serveur devra être spécifiée avant l'activation des
connecteurs réels et ne pourra pas être remplacée par la projection visuelle Angular.

## 9. Rudolf AI

### 9.1. Communauté

- contexte : historique privé de la conversation ;
- domaine : One Health uniquement ;
- limites par défaut : 12 requêtes/10 min et 100/jour/utilisateur ;
- taille d’une question : 2 000 caractères ;
- aucune navigation web temps réel ;
- aucun diagnostic ni remplacement d’autorité.
- toute génération ou suppression acquiert un bail MongoDB temporaire par conversation ; une
  collision renvoie `409 conversation_busy` et `Retry-After` ;
- une déconnexion ou la fin forcée du drainage interrompt OpenRouter et ne persiste jamais une réponse
  partielle ; la libération est liée au jeton propriétaire et l'expiration permet la reprise.

### 9.2. Hub

```text
Utilisateur autorisé
    ↓ JWT + HubAnalystGuard + limite de débit
Backend récupère les observations autorisées
    ↓ réduction/minimisation du contexte
OpenRouter reçoit contexte + instruction système
    ↓
Brouillon Markdown sécurisé
    ↓
Affichage + validation humaine + audit ai-draft
```

Usages : synthèse d’un dossier d’alerte, projet de rapport, explication multisectorielle et assistant latéral. Le prompt traite les contenus sources comme des données non fiables et ignore leurs instructions. Une campagne de tests adversariaux reste obligatoire avant données réelles.

### 9.3. Fournisseur OpenRouter — 26 septembre 2026

Un seul adaptateur `OpenRouterProviderService` dessert le chat et les brouillons Hub. Il utilise
`https://openrouter.ai/api/v1` avec `OPENROUTER_API_KEY` côté serveur uniquement. Le modèle par
défaut est `meta-llama/llama-3.3-70b-instruct` (payant) ; `OPENROUTER_MODEL` permet un identifiant
explicite différent. Les deux chemins, réponse complète et streaming, imposent
`provider.data_collection=deny` et `provider.zdr=true`. Aucun repli vers un fournisseur plus
permissif ou un autre modèle n'est effectué. Si aucun endpoint compatible ne répond, Rudolf
échoue seul ; les autres API et la readiness restent disponibles.

L'appel est borné par `OPENROUTER_TIMEOUT_MS` (60 s par défaut, sans retry automatique) ;
`DISTRIBUTED_LEASE_TTL_MS` doit lui être supérieur d'au moins 5 s. La réponse et les erreurs
brutes du fournisseur ne sont pas journalisées. Les HTTP 401, 402 et 429 sont classés sans
exposer les corps fournisseur. Le streaming interrompt la génération si le client part et ne
persiste aucune réponse incomplète.

`HUB_AI_EXTERNAL_PROVIDER_ENABLED=false` par défaut interdit tout appel Hub vers OpenRouter ;
le chat communautaire peut néanmoins fonctionner. Activer les quatre usages Hub seulement après
revue de souveraineté, résidence, sous-traitants, rétention et contrats des données réelles.
ZDR ne signifie pas que les données restent sur le serveur : elles transitent par OpenRouter et
un fournisseur de modèle. Les sorties restent des brouillons soumis à un humain.

Déploiement : créer une clé dédiée avec limite de dépenses sur OpenRouter, ajouter
`OPENROUTER_API_KEY` au `.env` **du backend de production uniquement**, en conservant les autres
variables et une seule définition par nom. Ne pas placer la clé dans les frontends, Git, Jenkins
ou les journaux. Déployer ensuite le backend, vérifier `/api/health/ready`, puis tester un message
Rudolf et une réponse progressive avec un compte de test. Une ancienne ligne `GROQ_API_KEY` est
ignorée ; elle peut être conservée brièvement pour rollback puis supprimée sans afficher sa valeur.
Rollback : redéployer la révision précédente, qui relira la clé Groq toujours présente sur le
serveur ; ne pas toucher à `/home/yabain/apps/onehealth-data/uploads`.

## 10. API Hub publique applicative

Toutes les routes sont sous `/api/hub` et nécessitent un JWT avec accès Hub.

```text
GET   /summary
GET   /observations
GET   /observations/:id
GET   /decisions
GET   /events
GET   /events/:eventCode
POST  /events
GET   /connectors
GET   /connectors/summary
POST  /connectors/synchronize
GET   /sharing-policies
PATCH /sharing-policies/:policyId
PATCH /signals/:signalCode/assign
PATCH /signals/:signalCode/decision
GET   /alerts/:observationId/reports
POST  /alerts/:observationId/reports
PATCH /reports/:reportId/status
GET   /demo/scenario
POST  /demo/scenario/run
GET   /demo/scenarios/:scenarioCode/report
POST  /demo/seed
POST  /ai/alerts/:id/summary
POST  /ai/reports/draft
POST  /ai/analyses/explain
POST  /ai/assistant
```

## 11. Déploiement

```text
GitHub ──► Jenkins (lint, build, tests, audit) ──► wrapper sudo borné
                                                        │
Internet ──► Apache/cPanel TLS ──► port partagé 3000 ──► PM2 : worker 0 + worker 1
```

Jenkins ne possède pas le `.env` applicatif et ne dispose pas d'un sudo général. Il peut seulement
exécuter `/usr/local/sbin/deploy-onehealth-backend` comme utilisateur `yabain`. Le wrapper et les
instructions d'exploitation se trouvent dans `onehealth_backend/ops/`. La configuration Apache
effective doit être auditée pour confirmer qu'elle ne rejoue pas silencieusement une écriture.

Le serveur dispose de Nginx `1.14.1`, mais le service est inactif ; Apache/cPanel possède réellement
les ports 80/443 et Node écoute sur 3000. Le pilote conserve donc Apache comme reverse proxy et
Nginx installé mais arrêté. Démarrer ou remplacer Nginx est interdit dans ce lot ; une migration de
serveur web devra avoir sa propre sauvegarde, fenêtre de maintenance et procédure de retour arrière.

Deux réglages facultatifs encadrent l'accès aux médias privés : `MEDIA_URL_SECRET` (secret de
signature, 32 caractères minimum) et `MEDIA_URL_TTL_MS` (durée de validité d'un lien, 7 jours par
défaut). Aucun des deux n'est requis au démarrage : à défaut, le secret est dérivé de `JWT_SECRET`
par séparation de domaine, de façon déterministe pour que les deux workers signent et vérifient à
l'identique. Conséquence à connaître : tant que `MEDIA_URL_SECRET` n'est pas défini, faire tourner
`JWT_SECRET` invalide aussi les liens de pièces jointes en circulation.

Chaque réponse API contient désormais un `X-Request-Id` validé ou généré. Les journaux structurés
associent cet identifiant au worker, à la méthode, au chemin sans query, au statut et à la durée,
sans corps ni Authorization. Le déploiement capture la révision précédente et la restaure
automatiquement si le build, PM2, la readiness, le nombre de workers ou CORS échoue.

| Composant | URL | Méthode actuelle |
|---|---|---|
| Communauté | `https://onehealthnetwork.yaba-in.com` | build Angular/Ionic vers hébergement web |
| Backend | `https://backend.onehealthnetwork.yaba-in.com` | script Bash, Node 20, PM2, health/CORS checks |
| Dashboard | `https://onehealthdashboard.yaba-in.com` | script Bash, build Angular et Apache |

Chemins serveur utilisés : `$HOME/apps/onehealth_backend`, `$HOME/apps/onehealth_dashboard` et un répertoire de données upload séparé. Le déploiement backend remet volontairement le dépôt serveur sur `origin/main` ; aucune modification manuelle ne doit vivre dans le worktree de production. Les secrets restent dans `.env` serveur.

Les vérificateurs `verify:cluster-security` et `verify:cluster-media-rudolf` doivent passer sur un
environnement jetable avant `CLUSTER_SECURITY_READY=true`. Le second observe deux workers, relit le
même fichier partagé et contrôle qu'une concurrence Rudolf n'écrit aucun échange en double.

Ordre d’un changement full-stack : backend → vérification `/api/health` et CORS → Dashboard/frontend → smoke test des routes profondes et de l’authentification.

## 12. Qualité et vérification

```bash
# Backend
npm run build
npm test -- --runInBand

# Dashboard
npm run build -- --configuration production --no-progress
npm test -- --watch=false --browsers=ChromeHeadless

# Frontend Ionic
npm run build
npm test -- --watch=false --browsers=ChromeHeadless
```

Les tests doivent être ciblés pendant le développement puis élargis selon le risque. Un build local réussi ne confirme pas que le bon commit est déployé.

## 13. Décisions d’architecture

| ID | Décision | État |
|---|---|---|
| ADR-01 | Deux frontends spécialisés, un backend partagé | maintenu |
| ADR-02 | MongoDB pour le MVP, base Hub logique séparée | maintenu |
| ADR-03 | REST et DTO versionnés avant toute complexité événementielle | maintenu |
| ADR-04 | Filtrage rôle/pays côté serveur | non négociable |
| ADR-05 | Raw, observation, événement, signal et alerte séparés | non négociable |
| ADR-06 | Validation humaine avant alerte et publication | non négociable |
| ADR-07 | Rudolf en lecture seule, contexte minimisé et audité | non négociable |
| ADR-08 | Seed et scénario idempotents pour la démonstration | maintenu |
| ADR-09 | Fallback Dashboard seulement pour démonstration | temporaire |
| ADR-10 | Pas de microservices/PostGIS avant preuve du besoin | maintenu |
| ADR-11 | Deux workers PM2, readiness applicative et arrêt progressif sur un hôte unique | implémenté, exercice externe restant |
| ADR-12 | Jenkins sans secrets applicatifs et sudo limité à un wrapper immuable | implémenté, installation serveur restante |
| ADR-13 | Apache/cPanel comme passerelle du pilote ; Nginx 1.14.1 reste installé et arrêté | état serveur confirmé |
| ADR-14 | Bail MongoDB propriétaire par conversation Rudolf et stockage média absolu partagé | implémenté, exercice externe restant |
| ADR-15 | Rapport de scénario embarqué, simulé et non officiel ; rapport d’alerte officiel séparé | implémenté |
| ADR-16 | Scénario borné à deux États CEEAC et 90 jours ; trois flux imposés et configuration auditée | implémenté |

### Rapport de fin de scénario — 23 septembre 2026

Une exécution complète construit un sous-document `simulationReport` dans
`hub_scenario_runs`, après création de l’événement et du signal. Il contient les
identifiants de scénario, événement, signal et observations, les sources, pays,
secteurs, constats, actions proposées, limites et date de génération. La génération
ajoute une entrée `SIMULATION_REPORT_GENERATED` dans `hub_audit_logs`.

`GET /api/hub/demo/scenarios/:scenarioCode/report` reste protégé par JWT,
`HubAccessGuard` et `HubAdminGuard`. Il refuse un scénario inconnu ou non terminé.
Pour compatibilité avec une exécution antérieure au nouveau champ, le service peut
reconstruire une restitution déterministe à partir de la date de fin et des
identifiants persistés, sans modifier la base pendant la lecture.

Le Dashboard expose le document sous `/rapports/scenario/:scenarioCode`, depuis le
moteur de scénario terminé et depuis la bibliothèque. Le rendu responsive présente
synthèse, KPI, chronologie, constats, recommandations, chaîne de preuve et limites.
L’impression utilise la page courante ; l’export HTML échappe toutes les valeurs API.
Les mentions « Simulation » et « Non officiel » sont obligatoires dans les deux
formats. Ce document n’utilise pas `hub_alert_reports` et n’offre aucune transition
de validation ou publication.

Pendant `POST /api/hub/demo/scenario/run`, le Dashboard affiche un modal plein écran
au-dessus de la vue stratégique. `backdrop-filter` produit le flou visuel, le contenu
de fond reçoit `inert`, le scroll du document est verrouillé et le
focus est déplacé dans le modal. L’animation du logo et de la progression respecte
`prefers-reduced-motion` et ne prétend pas représenter l’avancement serveur réel.
La requête cliente est bornée à 120 secondes afin qu’une connexion suspendue ouvre
l’état d’erreur/réessai au lieu de conserver indéfiniment un écran bloquant.
Après la réponse, le modal affiche succès avec Continuer/Afficher le rapport, ou
erreur avec Fermer/Réessayer. Un échec de rafraîchissement secondaire des KPI après
une exécution serveur réussie ne requalifie pas le scénario en échec.

### Scénario paramétrable — 23 septembre 2026

`POST /api/hub/demo/scenario/run` reçoit uniquement `sourceCountryCode`,
`comparisonCountryCode`, `dateFrom` et `dateTo`. Le DTO limite les codes aux onze
États CEEAC ; le service exige deux pays distincts, des dates ISO calendaires
valides, une fin non future selon `Africa/Douala` et une fenêtre maximale de 90
jours inclus. Le client ne peut pas fournir les secteurs, les sources, la politique
de partage, le score ou le statut : le serveur impose la convergence
humain–animal–environnement et les flux DHIS2, ARIS 3 et CAPC-AC.

La fabrique produit quatre observations explicitement simulées et des identifiants
déterministes contenant les deux pays ainsi que les deux bornes de période. Une
relance identique reste idempotente ; modifier une borne produit un autre jeu
traçable. Chaque observation référence la politique `POLICY-DEMO-<pays>` avant la
consolidation. La configuration est un sous-document optionnel et additif de
`hub_scenario_runs`; elle est copiée dans les audits de scénario, signal et rapport.
Les anciennes exécutions sans configuration restent lisibles avec le scénario
Cameroun–Tchad par défaut.

Dans le Dashboard, « Lancer le scénario » ouvre d’abord un formulaire modal avec
les onze États et les deux dates. Les trois sources obligatoires sont affichées en
lecture seule. Les mêmes contraintes sont vérifiées pour l’ergonomie côté client,
mais le backend reste l’unique autorité. Après validation, le modal bascule vers le
loader plein écran existant, puis vers le succès ou l’erreur. Le rapport et son
export HTML restituent la période et les pays sélectionnés et restent marqués
`Simulation` / `Non officiel`.

## 14. Dette et travaux structurants

### Lot local charge bornée — 14–15 septembre 2026

Référence versionnée : `onehealth_backend/specs/003-bounded-client-load/`.
La liste chat filtre d'abord les 100 salons autorisés puis récupère leurs participants
uniques en une requête ; `toPublicUser`, JWT et appartenance restent obligatoires.
Ionic suspend le polling à la sortie de l'écran, en arrière-plan et hors ligne. Les
messages/salons utilisent une requête en vol maximum, délai 15 s ; intervalles après
réponse de 4 s / 10 s, présence 30 s. Les accusés de lecture ne sont plus écrits toutes
les 8 s mais à réception de nouveaux messages. Les caches sont purgés au changement
de compte et les requêtes quittées annulées. Les signatures média renouvelées restent
prises en compte ; le scroll n'est plus déclenché à chaque cycle Angular.

Hub : pages de 100, trois au maximum en parallèle, délai de requête 30 s. AbortSignal
et génération isolent les changements de périmètre. Cache mémoire par périmètre 60 s,
purge au login/logout et refus 401/403. Les réponses auth/profil tardives d'une ancienne
session ne restaurent pas l'identité. Le logout purge immédiatement, même hors ligne.
Un jeu API vide est valide. Au-delà de 10 000 observations, erreur explicite sans
troncature ni fallback. Aucun nouveau port, service, secret, endpoint ou modèle ;
PM2, quotas partagés et `/home/yabain/apps/onehealth-data/uploads` sont inchangés.

Limites : chargement Hub complet encore transitoire, pagination offset non
transactionnelle, copies déjà reçues non révocables instantanément. Résumés serveur,
requêtes bbox/par écran et tests de charge en préproduction restent nécessaires.
Ce lot ne certifie ni 1 000 utilisateurs concurrents ni l'absence de vulnérabilités.
Preuves et réserves dans la fiche de validation de la spécification.

- vrais contrats de connecteurs et gestion des secrets par institution ;
- frontières GeoJSON, validation pays/coordonnées, clustering serveur optionnel et requêtes `bbox` pour les volumes institutionnels ;
- exercices d'intégration réels des limiteurs partagés, du bail Rudolf et du média commun ;
- stockage objet/CDN si plusieurs serveurs ou gros volumes média ;
- observabilité centralisée, métriques, traces et alerting ;
- sauvegarde/restauration testée et politique de rétention ;
- révocation/session plus robuste si le pilote l’exige ;
- suppression contrôlée des données et propagation entre dérivés ;
- tests de charge, pentest, revue juridique et tests IA adversariaux ;
- élimination du fallback simulé lors du passage institutionnel.

## 15. Registre paginé et protocole de charge — lot 004 (15 septembre 2026)

API existante GET /api/hub/observations étendue avec view=all|priority|country.
DTO valide les valeurs, conserve page 1..1000, limit 1..100, recherche max 100.
Repository construit d'abord le filtre souveraineté, intersecte la vue prioritaire
avec le stage demandé, échappe les regex et cherche aussi sourceSystem. Tri
observedAt desc/canonicalId asc, précédé de countryName asc pour la vue pays.
Lignes et total partagent le filtre ; maxTimeMS=5000 sur les deux opérations.
GET /api/hub/summary utilise désormais un $match pays puis un $group, délai 5 s,
avec le contrat de démonstration existant. Aucun nouveau modèle ni index persistant.

Angular : AlertRegistryStore, fourni au composant, contient une page de 8 et les
totaux serveur. Délai de coalescence 250 ms, timeout HTTP 30 s, annulation sur
nouvelle recherche/navigation/session ; comparaison d'identité avant publication.
Le résumé est chargé à l'ouverture/changement de session/réessai, pas à chaque page.
Pas de cache de données privées partagé entre comptes. Erreur != liste vide !=
simulation. CSV nommé « Exporter cette page », protections anti-formule
inchangées. Au-delà de 1 000 pages, invite explicite à affiner.

Le resolver complet n'est plus sur AppShell : il reste sur dashboard, etat-membre,
carte, alertes/:id, analyses et rapports. Ces six consommateurs restent transitoires
et ne doivent pas calculer leurs statistiques sur une simple page. Alertes, profil,
aide, connecteurs, souveraineté et administration ne préchargent plus tout le Hub.

Charge : scripts/load/hub-read.k6.js, garde-fou pur .mjs testé localement, protocole
dans scripts/load/README.md. HTTPS staging/preprod, origine approuvée et confirmation
de données de test ; redirections interdites ; 1 identité viewer distincte par VU.
Plateaux progressifs, 1 000 VU durant 10 min, attentes 4–6 s, erreurs/429 comptées,
p95/p99 et métriques dédiées au plateau. Scripts hors dist et racines publiques,
identités/résultats bruts ignorés Git. Aucun test distant exécuté : production seule.
Un nom DNS ne prouve pas l'isolation : infra, bases, uploads et générateur à vérifier.

Déploiement : backend avant dashboard (nouvelle valeur DTO). Aucun redémarrage,
déploiement ni modification production dans ce lot. Après déploiement : vérifier
readiness, login, page Alertes et ses filtres, navigation page 2, erreur/réessai et
CSV limité à la page, puis les vues historiques. Retour arrière : version précédente
du dashboard puis backend ; aucune migration de données à inverser. Conserver
/home/yabain/apps/onehealth-data/uploads intact. Preuves dans specs/004-server-pagination-load/validation.md.
