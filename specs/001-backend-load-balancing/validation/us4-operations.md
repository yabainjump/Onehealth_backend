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
