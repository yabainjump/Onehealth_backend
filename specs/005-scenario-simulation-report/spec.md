# Rapport de fin de scénario

2026-09-23 — Fonctionnalité demandée par le propriétaire.

À la fin du scénario dynamique Cameroun–Tchad, un administrateur du Hub doit
pouvoir consulter un rapport structuré de l’exécution. Ce document restitue les
observations simulées, leur provenance, la corrélation intersectorielle, le signal
produit, les constats, les actions proposées et les limites de la démonstration.

Le rapport est un **rapport de simulation non officiel**. Il ne doit ni devenir
un `HubAlertReport`, ni faire croire qu’un signal a été vérifié, ni contourner la
validation humaine. Il porte durablement les marqueurs `simulated: true` et
`official: false` dans l’API, l’écran, l’impression et le fichier exporté.

## Critères d’acceptation

- L’exécution réussie du scénario enregistre un instantané de rapport lié à la
  dernière exécution et écrit une trace d’audit dédiée.
- Une ancienne exécution complète sans instantané reste consultable grâce à une
  restitution déterministe fondée sur ses identifiants et sa date de fin.
- Seul un administrateur Hub authentifié peut appeler le point de terminaison du
  rapport ; un scénario inconnu ou non terminé ne renvoie aucun faux document.
- Le tableau de bord affiche un appel à l’action seulement lorsque le rapport est
  disponible.
- Pendant l’exécution, un modal plein écran bloque les doubles soumissions, rend le
  fond inerte et affiche le logo ; au résultat, il propose Continuer/Afficher le
  rapport ou Fermer/Réessayer en cas d’échec.
- La page du rapport présente synthèse, indicateurs, chronologie, constats,
  recommandations, traçabilité et limites, puis permet impression/PDF et export
  HTML avec échappement des données.
- Le rapport officiel d’alerte et ses transitions restent inchangés.
