# Validation

## Résultats du 23 septembre 2026

- Backend `npm run lint` : réussi.
- Backend `npm run build` : réussi.
- Backend `npm test -- --runInBand` : 47 suites, 212 tests réussis.
- Dashboard `npm run lint` : réussi.
- Dashboard `npm run build` : réussi ; chunk lazy
  `scenario-report-page` produit.
- Modal scénario : lint et build réussis avec fond `inert`, focus explicite, verrou
  de scroll et réduction des animations selon la préférence système.
- Dashboard `npm test -- --watch=false --browsers=ChromeHeadless` : les bundles de
  tests, dont `scenario-report-presenter.spec`, compilent ; ChromeHeadless ne démarre
  pas sur ce poste Windows car son processus GPU termine avec
  `exit_code=-1073741790`. Aucun test navigateur n’a donc été exécuté localement.

## Contrôles couverts

- rapport généré avec quatre observations et chaîne scénario/événement/signal ;
- marqueurs immuables `reportType: SIMULATION`, `simulated: true`, `official: false` ;
- refus HTTP 409 tant que l’exécution n’est pas terminée ;
- compatibilité de lecture d’une ancienne exécution sans sous-document ;
- audit dédié de génération ;
- échappement des chaînes API dans l’export HTML ;
- maintien du workflow `HubAlertReport` existant sans modification.

## Validation restant à faire après déploiement

- lancer le scénario avec un compte `hub_admin` ;
- ouvrir le rapport depuis le dashboard puis depuis `/rapports` ;
- vérifier l’impression/PDF et le fichier HTML sur desktop et mobile ;
- confirmer l’entrée d’audit sur la base Hub et les réponses 403 d’un rôle non admin.
