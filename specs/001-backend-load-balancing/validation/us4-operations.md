# Validation US4 — observabilité et rollback

Date : 2026-08-23

## Preuves locales

| Contrôle | Résultat |
|---|---|
| Identifiant entrant sûr conservé | PASS |
| Identifiant court, trop long ou contenant des caractères interdits remplacé par UUID | PASS |
| `X-Request-Id` présent sur health, live et ready | PASS |
| Logs JSON avec request ID, instance, méthode, chemin sans query, statut et durée | PASS |
| Authorization, corps, mot de passe et query non transmis au logger | PASS |
| Révision précédente capturée avant mise à jour Git | PASS |
| Échec build/reload/readiness/CORS déclenche le rollback | PASS — contrat Jest |
| Rollback reconstruit, recharge et revérifie deux workers + CORS | PASS — contrat Jest |
| ESLint et build | PASS |
| Suite unitaire complète | PASS — 38 suites, 130 tests |
| Suite e2e | PASS — 1 suite, 3 tests |
| Syntaxe Bash du script de déploiement | PASS — Git Bash `bash -n` |
| Audit npm | PASS — 0 vulnérabilité |

La syntaxe a été contrôlée localement avec Git Bash. Le même `bash -n` reste inclus dans la
vérification préalable recommandée sur AlmaLinux.

## Exercice externe restant

T053 reste ouvert jusqu'au test d'une révision volontairement non prête sur un environnement
jetable. Il faut enregistrer uniquement les hashes Git, la décision et les durées, jamais le `.env`.

## Incident de déploiement du 25 août 2026

La candidate `fd307d2afbed55219b17f00069befcf22e7f15ce` a compilé et démarré deux workers,
mais le contrôle strict n'a pas observé cette révision sur les deux réponses readiness. Le rollback
automatique a fonctionné et restauré `7409571f42ee881d09b25d0bc78167134c3d2b04`.

Le correctif déclare désormais `APP_VERSION` explicitement dans `ecosystem.config.cjs`, afin que
`startOrReload --update-env` la propage aux deux workers. En cas de nouvel échec, le script affiche
les couples version/instance observés et l'état PM2 sans exposer l'environnement complet.

| Contrôle après correctif | Résultat |
|---|---|
| Contrats du script de déploiement | PASS — 1 suite, 8 tests |
| Syntaxe Bash | PASS — Git Bash `bash -n` |
| ESLint | PASS |
| Build NestJS | PASS |

T058 reste ouvert jusqu'au redéploiement et à l'observation de deux workers portant la même nouvelle
révision.
