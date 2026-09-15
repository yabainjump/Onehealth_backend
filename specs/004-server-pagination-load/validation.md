# Validation locale — 15 septembre 2026

## Résultat et limites

Registre Alertes paginé sur le serveur, résumé scoped, erreurs explicites,
annulation au changement de filtre/session, CSV page explicite et déplacement
du resolver complet implémentés. Pas de nouveau modèle, service déployé ou index.
Constitution Check final : autorisation et souveraineté restent backend, workflows
et IA inchangés, pas de secret ajouté, ni écriture distante, ni migration destructive.
Les modifications du lot 003 sont conservées dans les trois dépôts indépendants.

La pagination de carte/analyses/rapports/État membre/dossier/vue stratégique n'est
PAS achevée : chargement complet borné conservé pour ne pas fausser leurs calculs.

## Vérifications exécutées

- Backend `npm.cmd run lint` : réussi après correction du typage des mocks de test.
- Backend `npm.cmd run build` : réussi.
- Backend `npm.cmd test -- --runInBand` : 46 suites, 209 tests réussis.
- Dashboard `npm.cmd run lint` : réussi.
- Dashboard `npm.cmd run build` : réussi, templates et routes compilés.
- Dashboard ChromeHeadless : 56 tests réussis. La sandbox Windows empêchait le
  démarrage GPU de Chrome ; relance locale hors sandbox réussie, sans serveur distant.
- `node --test scripts/load/hub-load-guard.test.mjs` : 4 tests réussis, sans réseau.
- `node --check scripts/load/hub-read.k6.js` : syntaxe valide.
- `git diff --check` backend/dashboard : réussi (avertissements CRLF seulement).
- Aucun chemin scripts/load ou Spec Kit trouvé dans le build backend dist.

Tests ajoutés : DTO pagination/vue invalide, pays interdit y compris pour total,
intersection priorité/stage, regex littérale, ordre stable, limites de requête,
scope avant agrégation, page seule/totaux serveur, annulation/recherche coalescée,
purge au logout et erreur sans mock. Les tests Mongo utilisent des modèles mockés :
ils ne prouvent ni les plans d'exécution ni la latence d'une vraie base.

## Test 1 000 utilisateurs : NON EXÉCUTÉ

Le propriétaire confirme : uniquement la production à deux workers. Aucun trafic
de charge n'a été envoyé vers celle-ci. k6 n'est pas installé localement ; le
script est préparé et sa syntaxe/garde-fous vérifiés, pas son exécution native.
Suivre scripts/load/README.md après création et validation de la préproduction.
Un domaine staging qui redirige vers les bases/workers production n'est pas suffisant.

Le scénario ne teste que des lectures API du Hub avec viewers distincts. Un test
réussi ne certifiera pas le rendu navigateur, les pics de login, chat, médias ou IA.
Ne pas annoncer « 1 000 utilisateurs supportés » sans plateau réellement atteint,
métriques du générateur et serveur, tests complémentaires et rapport nettoyé.

## Déploiement et retour arrière

Non déployé et non poussé par l'agent. Backend avant dashboard, puis smoke test
readiness/login/Alertes/filtres/page 2/CSV et routes historiques. En cas de régression,
restaurer d'abord la version précédente du dashboard, puis le backend. Pas de migration
à inverser ; ne jamais effacer /home/yabain/apps/onehealth-data/uploads.
Scripts k6, specs et credentials hors dist/racines publiques ; pas de lancement
automatique dans Jenkins. Documents locaux project-docs synchronisés mais ignorés
Git ; conserver une sauvegarde séparée. Spécification et protocole sont versionnables.
