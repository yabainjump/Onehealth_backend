# Validation

Validation locale du 26 septembre 2026 :

- `npm run build` backend : succès.
- `npm run lint` backend : succès.
- `npm test -- --runInBand` backend : 48 suites, 222 tests réussis.
- Tests ciblés après ajustement final : 3 suites, 13 tests réussis ; ESLint ciblé réussi.
- `npm run build -- --configuration production --no-progress` dashboard : succès.
- Test Ionic ciblé `auth.interceptor.spec.ts` sous ChromeHeadless : 2 réussis ;
  confirme que l'URL OpenRouter ne reçoit pas le jeton du backend.
- SDK `openai` fixé à la ligne 6.x après vérification : la 7.x exige Node 22, incompatible
  avec le serveur Node 20. Build et 222 tests revalidés après correction.
- `git diff --check` dans les trois dépôts : succès (avertissements CRLF Windows seulement).
- `npm audit --omit=dev` : six vulnérabilités détectées dans d'autres dépendances
  (4 high, 1 moderate, 1 low), non imputées à `openai`. Suivi séparé requis ; pas de
  mise à jour automatique aveugle dans ce lot.

Constitution Check après implémentation : aucun contrat public, rôle, filtre pays ou état
Hub modifié. La clé n'entre ni dans Git ni dans les frontends. Envoi Hub interdit par défaut,
sorties non officielles et auditées. Le fournisseur reste optionnel pour readiness.
Le streaming annulé ne persiste toujours aucune réponse partielle. Aucune migration de données.

Non vérifié sans clé utilisateur ni accès au serveur : appel réel OpenRouter, budget du compte,
qualité des réponses, smoke test après déploiement et revue de résidence des données Hub.
Pas d'appel à une clé réelle ni à la production dans ce lot.
