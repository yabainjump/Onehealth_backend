# Validation US3 — médias et Rudolf cohérents entre workers

Date : 2026-08-23

## Résultats locaux

| Contrôle | Résultat |
|---|---|
| Bail MongoDB acquis par conversation et sujet pseudonymisé | PASS |
| Libération conditionnée par le jeton propriétaire | PASS |
| Bail expiré récupérable par un autre worker | PASS |
| Collision bornée → HTTP 409 `conversation_busy` + `Retry-After` | PASS |
| Indisponibilité de coordination → HTTP 503 sans appel Groq | PASS |
| Déconnexion client → interruption du streaming sans persistance partielle | PASS |
| Arrêt progressif → interruption après expiration du délai de drainage | PASS |
| Échange utilisateur/assistant écrit dans une seule opération MongoDB | PASS |
| `UPLOADS_DIR` absolu obligatoire en production | PASS |
| Dossier média créé et validé lisible/inscriptible avant le trafic | PASS |
| Fichier à la place d'un dossier média refusé au démarrage | PASS |
| Vérificateur externe refuse de s'exécuter sans confirmation | PASS |
| ESLint et build | PASS |
| Suite unitaire complète | PASS — 36 suites, 120 tests |
| Suite e2e | PASS — 1 suite, 1 test |
| Audit npm | PASS — 0 vulnérabilité |
| Invariants PM2/Nginx | PASS |

Les tests ne consignent ni identifiant utilisateur brut, ni contenu privé, ni clé Groq. Les clés de
bail sont dérivées par HMAC et le fichier de vérification externe est aléatoire, non exécutable et
supprimé dans un bloc de nettoyage.

## Exercice cluster externe restant

Le test local ne peut pas prouver quel worker PM2 a servi chaque requête. Après déploiement sur un
environnement jetable à deux workers, exécuter `npm run verify:cluster-media-rudolf` avec les
variables documentées dans le README. Le script doit observer deux `instanceId`, relire douze fois
le même contenu média, provoquer deux envois Rudolf concurrents et vérifier qu'un succès produit
exactement un couple de messages. La conversation et le fichier de contrôle sont supprimés.

L'exercice de perte brutale du propriétaire doit ensuite être réalisé sur cet environnement : tuer
uniquement le worker identifié pendant une génération longue, attendre l'expiration
`DISTRIBUTED_LEASE_TTL_MS`, puis vérifier qu'une nouvelle génération peut acquérir le bail sans
qu'un ancien propriétaire puisse le supprimer.

T040 et `CLUSTER_SECURITY_READY=true` restent volontairement bloqués jusqu'à ces preuves externes.
