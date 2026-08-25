# Validation US4 — médias distants maîtrisés

Date : 2026-08-24

## Résultats locaux

| Contrôle | Résultat |
|---|---|
| Chemin local d'upload accepté | PASS |
| Ressource d'application (`assets/`) acceptée | PASS |
| Origine propre du produit acceptée | PASS |
| Origine locale de développement en HTTP acceptée | PASS |
| Fournisseur d'avatar historique Google accepté | PASS |
| Fournisseur d'avatar historique Firebase accepté | PASS |
| Schéma `javascript:` refusé | PASS |
| Schéma `data:` refusé | PASS |
| Traversée de répertoire refusée | PASS |
| Antislash dans un chemin local refusé | PASS |
| Identifiants intégrés à l'URL refusés | PASS |
| Hôte tiers arbitraire refusé | PASS |
| Hôte tiers avec paramètre de pistage refusé | PASS |
| HTTP en clair vers une origine du produit refusé | PASS |
| Imitation par suffixe `googleusercontent.com.attaquant.example` refusée | PASS |
| Imitation par suffixe `notfirebasestorage.googleapis.com.evil.test` refusée | PASS |
| Tests ciblés `common/validation` | PASS — 1 suite, 16 tests |

## Mise en conformité constitutionnelle

Le principe VII exige que « CORS, **media URLs**, uploads and proxy trust MUST use explicit
allow-lists ». L'implémentation acceptait jusqu'ici n'importe quel hôte HTTP(S) sur six champs :
`register.photoURL`, `profile.photoURL`, `profile.coverPhotoURL`, `post.attachment.url`,
`chat.imageUrl` et `chat.fileUrl`. Cette tâche rétablit la conformité.

## Précaution d'exploitation

Le contrôle échoue fermé : un compte existant portant une photo hébergée sur un hôte désormais non
listé verra sa **mise à jour de profil** refusée avec HTTP 400, la valeur étant resoumise par le
formulaire. Les données déjà stockées ne sont pas modifiées. À vérifier sur les données réelles avant
mise en service ; le cas échéant, l'hôte concerné doit être ajouté à la liste.
