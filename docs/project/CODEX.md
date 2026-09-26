# Mode opératoire Codex — One Health Network

Ce fichier complète `AGENTS.md` avec les commandes et habitudes propres à ce workspace.

## Démarrage d’une tâche

```powershell
Set-Location D:\personnel\One_health\One_health2
git -C onehealth_backend status --short
git -C onehealth_dashboard status --short
git -C onehealth_frontend status --short
```

Puis lire les documents de `onehealth_backend/docs/project/` et chercher avec `rg`/`rg --files`.
Ne pas commencer par une réécriture globale.

## Carte rapide

| Besoin | Point d’entrée principal |
|---|---|
| Auth, Google, reset | `onehealth_backend/src/auth`, `onehealth_frontend/src/app/pages/login` |
| Profils et follow | `backend/src/users`, `frontend/src/app/profils` |
| Publications | `backend/src/posts`, `frontend/src/app/pages/tabs/dashbord` |
| Alertes communautaires | `backend/src/alerts`, `frontend/src/app/pages/alerts` |
| Messagerie | `backend/src/chat`, `frontend/src/app/pages/home` |
| Rudolf communautaire | `backend/src/rudolf`, `frontend/.../home/rudolf-chat` |
| Hub CEEAC | `backend/src/hub`, `dashboard/src/app/pages` |
| Rudolf Hub | `backend/src/hub/services/hub-ai.service.ts`, `dashboard/src/app/core/data/hub-ai-api.service.ts` |
| Déploiement | les scripts `deploy-onehealth-*.sh` dans chaque dépôt |

## Commandes de développement

### Backend

```powershell
Set-Location onehealth_backend
npm install
npm run start:dev
npm run build
npm test -- --runInBand
```

Prérequis locaux : `.env` valide avec MongoDB et JWT. Ne jamais imprimer le contenu complet de `.env`.

### Dashboard

```powershell
Set-Location onehealth_dashboard
npm install
npm run start:local-api
npm run build -- --configuration production --no-progress
npm test -- --watch=false --browsers=ChromeHeadless
```

Le proxy local vise `/api`. Vérifier que le backend écoute avant de diagnostiquer une erreur de scénario ou Rudolf.

### Application Ionic

```powershell
Set-Location onehealth_frontend
npm install
npm start
npm run build
npm test -- --watch=false --browsers=ChromeHeadless
```

## Contrats et environnements

- API production : `https://backend.onehealthnetwork.yaba-in.com/api`.
- Communauté : `https://onehealthnetwork.yaba-in.com`.
- Dashboard : `https://onehealthdashboard.yaba-in.com`.
- Le backend exige une seule variable `CORS_ORIGIN` contenant toutes les origines séparées par des virgules.
- `OPENROUTER_API_KEY` reste uniquement dans le backend ; ne jamais le copier dans Ionic ou Angular.
- Modèle Rudolf par défaut : `meta-llama/llama-3.3-70b-instruct` (payant), avec routage `data_collection: deny` et `zdr: true`. `HUB_AI_EXTERNAL_PROVIDER_ENABLED` reste `false` tant que la revue de souveraineté/résidence n'a pas autorisé l'envoi de données Hub au fournisseur externe.
- Swagger peut être désactivé sans empêcher les clients d’appeler l’API.
- Les fichiers `environment*.ts` du Dashboard sont ignorés : comparer les examples et la configuration générée au déploiement.

## Stratégie d’implémentation

Pour une fonctionnalité full-stack :

1. définir le DTO et le modèle de réponse ;
2. appliquer garde et portée serveur ;
3. implémenter service/repository et audit ;
4. tester le backend ;
5. ajouter service Angular typé ;
6. construire états loading/success/empty/error ;
7. vérifier mobile/desktop et accessibilité ;
8. builder les deux dépôts ;
9. documenter le contrat et le déploiement.

Pour un diagnostic, ne pas implémenter automatiquement une correction sans autorisation. Pour une demande de changement, livrer code et validation, pas seulement des extraits.

## Pièges déjà rencontrés

- CSP bloquant Firebase, Google Fonts ou les tuiles OpenStreetMap ;
- service worker servant une ancienne politique après actualisation normale ;
- plusieurs lignes `CORS_ORIGIN` dans `.env`, la dernière écrasant la première ;
- frontend local appelant directement la production au lieu du proxy ;
- images Google/Firebase instables : utiliser le miroir backend et le fallback ;
- Swagger désactivé confondu avec une API indisponible ;
- seed de démonstration absent après déploiement ;
- réponse Rudolf Markdown affichée comme texte brut ;
- fallback du Dashboard masquant une panne API.

## Règles pour les données de démonstration

- Seed attendu : 165 raw records + 165 observations + 33 connecteurs + 11 politiques.
- Le scénario restaure le socle puis ajoute quatre observations, un événement et un signal.
- Son entrée est bornée à deux pays CEEAC distincts et une période ISO non future
  de 90 jours maximum. Ne jamais accepter du client des secteurs, sources ou
  politiques de partage libres : le serveur impose DHIS2, ARIS 3 et CAPC-AC.
- La combinaison pays/période fait partie des identifiants déterministes. Conserver
  l’instantané de configuration dans l’exécution, l’audit et le rapport.
- Une exécution complète ajoute un rapport de simulation à `hub_scenario_runs` et un
  audit `SIMULATION_REPORT_GENERATED`. Ne jamais le convertir en `HubAlertReport` :
  il doit rester `simulated: true` et `official: false` dans l’API et les exports.
- L’écran d’attente du scénario reste ouvert jusqu’à la réponse API. Préserver
  `inert`, le verrouillage du scroll, le focus programmatique, l’état erreur/réessai
  et `prefers-reduced-motion`; ne jamais afficher un pourcentage fictif.
- Ne pas créer de route destructive de reset pour faciliter une démo.
- Le seed doit rester idempotent et être exécuté explicitement ou via l’option de déploiement prévue.

## Fin de tâche

Charge et sessions : tester les fichiers du lot backend `003-bounded-client-load`,
`foreground-poller.spec.ts`, les services chat Ionic, données Hub et auth Dashboard.
Inclure changement de compte/pays pendant une requête, 401/403, document masqué,
sortie Ionic et dépassement du plafond. Ne jamais exécuter de benchmark contre la
production sans autorisation dédiée. Build et tests unitaires ne prouvent pas une
capacité réelle. Consigner les commandes et résultats dans `validation.md` du lot.

```powershell
git -C onehealth_backend diff --check
git -C onehealth_dashboard diff --check
git -C onehealth_frontend diff --check
```

Relire les fichiers modifiés, annoncer les tests réellement exécutés, les éventuels tests non exécutés, les migrations/configurations requises et l’ordre de déploiement. Ne jamais prétendre qu’une version locale est déjà en ligne.

## Pagination et charge : lot 004

Suivre specs/004-server-pagination-load/ et scripts/load/README.md dans le backend.
Validation locale : lint/build backend et dashboard, Jest backend, Angular tests,
node --test scripts/load/hub-load-guard.test.mjs et contrôle syntaxe du script k6.
Ces vérifications ne démarrent pas une charge distante et ne prouvent pas 1 000 VU.
k6 n'est pas installé dans le workspace ; son exécution native reste à valider.

Déployer backend avant dashboard. La pagination nouvelle concerne le registre,
pas encore les six vues historiques documentées. Ne pas les tronquer silencieusement.
Ne rien envoyer vers les domaines de production pour tester la capacité. Obtenir
d'abord la préproduction isolée, ses données de test et l'autorisation de campagne.
