# Validation — charge bornée

Date : 15 septembre 2026. Validation locale Windows, Node v22.22.0, Chrome Headless 152.
Aucun push, déploiement, changement d'environnement serveur ou test de charge production.

## Preuves

- Dashboard : suite complète `npm test -- --watch=false --browsers=ChromeHeadless` :
  **52 tests réussis**, dont isolation de session, pagination et annulation.
- Ionic : build production réussi ; tests ciblés `foreground-poller`, service chat et
  page chat : **7 tests réussis**. Lint global réussi.
- Dashboard : lint global et build final production réussis.
- Backend : `npm run lint`, `npm run build`, `npm test -- --runInBand` réussis :
  **44 suites, 194 tests réussis**. La suite comprend les nouveaux tests de salons privés.
- `git diff --check` réussi dans les trois dépôts (seuls avertissements LF/CRLF Git).
- Les premiers échecs étaient un lint de fixture, des fixtures TypeScript incomplètes,
  puis les restrictions du bac à sable sur Chrome et les polices Google. Fixtures
  corrigées ; Chrome/build relancés avec autorisation locale, aucune CSP assouplie.

Total final : **253 tests réussis** (194 backend + 52 Dashboard + 7 Ionic ciblés).
La suite Ionic entière n'a pas été exécutée. Les tests Angular ont été lancés avec
`CHROME_BIN` pointant sur Chrome installé ; les tests backend n'utilisent pas les bases
de production. Les avertissements SMTP des tests concernent leur environnement isolé.

## Cas contrôlés

- Participants chargés uniquement après filtre serveur des salons ; projection publique
  conservée, absence d'email privé, téléphone, rôles Hub et hash dans la réponse.
- Non-membre refusé avant lecture/écriture des messages et émission des signatures.
- Une requête de rafraîchissement en vol ; arrêt du polling caché/hors ligne/quitté.
- Ancienne conversation/session annulée ; une réponse auth/profil retardée ne restaure
  pas le compte précédent ; anciennes données Hub rejetées même si l'annulation arrive tard.
- Liste vide API conservée ; erreurs 401/403 et plafond >10 000 sans fallback simulé.
- Lecture répétée des mêmes messages entrants dédupliquée.

## Revue critique et limites

Pas de nouvelle surface réseau ni dépendance. Les limites client limitent la charge
normale, **pas les requêtes d'un attaquant** : les gardes et quotas serveur restent
indispensables. Pas d'audit exhaustif, pentest ou promesse de risque zéro.

La pagination offset n'est pas un snapshot, et tout le dataset Hub reste chargé en
mémoire jusqu'au plafond de 10 000. Prochain lot : résumés serveur, pagination par
écran et carte bbox, toujours après filtrage souverain. Les caches à TTL ne rendent
pas révocables les copies déjà reçues. Le polling REST reste périodique.

Le build Ionic montre aussi un chunk paresseux d'édition de profil de 8,29 Mo bruts :
c'est une piste séparée d'optimisation des données géographiques, pas un benchmark serveur.

Avant d'annoncer 1 000 utilisateurs, sur une préproduction explicitement autorisée :
monter progressivement 50/100/250/500/1 000 usagers avec temps de réflexion, identités
et pays distincts ; mesurer p95, erreurs, CPU, mémoire, event loop et MongoDB. Séparer
lecture Dashboard, chat et Rudolf (quota fournisseur), puis tester un mix réaliste.
Objectifs et seuils d'arrêt à convenir avant le test ; aucune injection réelle de charge
n'est effectuée dans ce lot. Refaire le smoke mobile/PWA et la navigation chat au déploiement.

## Retour arrière

Revenir aux commits précédents du lot puis reconstruire les applications ; aucun
rollback de base. Garder `/home/yabain/apps/onehealth-data/uploads` intact. Ordre de
livraison : backend, vérifications santé/CORS, puis clients et smoke test authentifié.
Spec Kit reste versionné mais exclu des artefacts runtime. Les six `project-docs/*.md`
restent locaux/ignorés par Git et doivent être sauvegardés séparément.
