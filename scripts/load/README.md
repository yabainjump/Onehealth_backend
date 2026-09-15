# Mesure de charge Hub — PRÉPRODUCTION UNIQUEMENT

État au 15 septembre 2026 : **non exécuté**. Le propriétaire dispose uniquement
de la production à deux workers. Ne lancer aucune commande k6 contre celle-ci.
Le test des garde-fous ci-dessous ne génère aucune requête réseau.

## Prérequis avant toute charge

- Préproduction sur des ressources distinctes de la production ; un autre sous-domaine
  sur les mêmes workers/bases/disques ne constitue PAS une isolation.
- Deux workers comparables, mêmes versions et politiques de sécurité, Mongo de test
  distinct pour communauté ET Hub, stockage uploads distinct. Ne jamais référencer
  `/home/yabain/apps/onehealth-data/uploads` depuis cette préproduction.
- DNS/TLS `staging.*` ou `preprod.*`, origine explicitement approuvée, données fictives
  uniquement, SMTP/notifications désactivés ou sandbox, Groq non sollicité.
- Générateur k6 sur une autre machine. Pas de Jenkins concurrent ni de génération
  de charge sur l'hôte dont on mesure les capacités.
- 2 comptes pour smoke, 1 000 pour capacity : vrais comptes de test différents,
  rôle `user`, rôle Hub uniquement `hub_viewer`, pays explicites. Tokens obtenus
  sur CETTE préproduction, valables pendant tout le test (au moins 45 minutes).
  Aucun compte administrateur ni token de production. Pas de désactivation des quotas.
- Jeu représentatif déclaré : nombre d'observations, répartition pays/secteurs,
  stages/dates, dossiers et événements. Les 165 fixtures seules ne prouvent pas
  le comportement sur des volumes institutionnels ; répéter à volume représentatif.

Le garde-fou valide le nom et la confirmation ; il ne peut pas prouver que DNS,
reverse proxy, Mongo et stockage ne pointent pas vers la production. Cette vérification
humaine est obligatoire. Les redirections HTTP sont désactivées pour éviter de
transmettre les tokens à un autre hôte.

## Fichier local privé

Chemin suggéré : `secrets/hub-load.identities.json` (ignoré par Git, chmod 600 sous Linux).
Format JSON : tableau d'objets avec `token` (JWT de test) et `countryCodes` (tableau
des codes pays autorisés). Le setup vérifie `/auth/me`, l'unicité réelle des comptes
et les droits avant de démarrer. Ne pas copier de token dans un ticket ou un terminal
enregistré. Ne pas activer `--http-debug` ni publier ce fichier dans les artifacts CI.

## Vérification locale sans réseau

Depuis le backend :

```sh
node --test scripts/load/hub-load-guard.test.mjs
node --check scripts/load/hub-read.k6.js
```

## Exécution future, après disponibilité et autorisation de la préproduction

Installer k6 selon la documentation officielle sur le générateur. Aucun paquet
runtime Node/Angular n'est ajouté. Exemple à adapter avec l'URL APPROUVÉE :

```sh
export OHN_LOAD_BASE_URL='https://staging.example.test/api'
export OHN_LOAD_APPROVED_ORIGIN='https://staging.example.test'
export OHN_LOAD_CONFIRM='ISOLATED_STAGING_TEST_DATA_ONLY'
export OHN_LOAD_IDENTITIES_FILE='/chemin/prive/hub-load.identities.json'
export OHN_LOAD_PROFILE='smoke'
k6 run scripts/load/hub-read.k6.js
```

Seulement après smoke réussi et examen des métriques :

```sh
export OHN_LOAD_PROFILE='capacity'
mkdir -p scripts/load/results
k6 run --summary-export scripts/load/results/hub-capacity.json scripts/load/hub-read.k6.js
```

Ne pas ajouter `--vus`, `--stages`, `--no-thresholds` ou `--insecure-skip-tls-verify` :
ces options changeraient le protocole ou affaibliraient ses contrôles. Effacer les
identités de test après la campagne et révoquer/laisser expirer leurs tokens.

## Protocole et interprétation

Montée 10 → 100 → 500 → 1 000 VU, plateau 1 000 pendant 10 minutes, descente 2 minutes.
Chaque VU parcourt des pages de 8, lit périodiquement un résumé et un dossier, puis
attend 4 à 6 secondes. Il s'agit de sessions actives simulées, pas de 1 000 requêtes
par seconde. L'authentification initiale est vérifiée avant mesure, pas testée en rafale.

Objectifs proposés : erreurs HTTP <1 %, p95 <1 s, p99 <2,5 s, aucun dépassement pays.
Les 429/401/403/5xx sont des échecs, pas des succès artificiels. Arrêt anticipé
si taux d'erreurs dépassé après 30 s ou fuite de périmètre. Métriques spécifiques
au plateau pour éviter de masquer sa latence dans la moyenne des faibles charges.
Le compteur de plateau ne remplace pas la preuve du graphe `vus=1000` pendant 10 min.
Le succès des lectures ne certifie PAS chat, médias, Rudolf, rendu navigateur ou
toutes les fonctions des deux applications. Les filtres complexes et volumes de
grands jeux nécessitent des scénarios complémentaires.

Enregistrer : SHA backend/dashboard, versions Node/Mongo/k6, configuration des deux
workers, ressources du serveur ET générateur, volume de données, débit, p95/p99
par endpoint et plateau, CPU/RAM, event-loop lag, pools/temps Mongo, redémarrages
PM2 et readiness. Vérifier les plans `explain` et index réels avant de multiplier
les index. Arrêter immédiatement en cas d'impact sur la production ou d'instabilité.
Après descente, vérifier readiness et absence de croissance RAM/redémarrages.

## Références et publication

- [k6 ramping-vus](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ramping-vus/)
- [Seuils et arrêt anticipé](https://grafana.com/docs/k6/latest/using-k6/thresholds/)

Scripts et spécifications restent dans Git, hors `dist`, racines publiques et
artefacts applicatifs. Résultats bruts locaux ignorés ; ajouter uniquement une
synthèse nettoyée à `specs/004-server-pagination-load/validation.md` après exécution.
