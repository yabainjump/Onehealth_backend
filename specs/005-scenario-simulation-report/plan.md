# Plan et Constitution Check

1. Définir un sous-document Mongo optionnel `simulationReport` sur l’exécution du
   scénario et un constructeur pur, déterministe et testable.
2. Construire et enregistrer l’instantané seulement après consolidation réussie,
   puis auditer sa génération avec les identifiants de traçabilité.
3. Exposer une lecture dédiée protégée par JWT, `HubAccessGuard` et
   `HubAdminGuard`, sans endpoint de publication ni transition officielle.
4. Ajouter au dashboard une page de restitution moderne, responsive et imprimable,
   accessible depuis le scénario terminé, avec export HTML sûr.
5. Tester contrats et régressions, exécuter lint/build/tests, puis synchroniser les
   documents d’architecture et produit.

## Constitution Check

- La portée régionale est imposée par `HubAdminGuard`; aucune portée pays reçue du
  client n’est considérée comme fiable.
- Observation, événement, signal, alerte vérifiée, rapport de simulation et rapport
  officiel restent des objets sémantiquement distincts.
- Le moteur ne valide aucune alerte : `official` reste `false` et les limites le
  rappellent dans tous les formats.
- Les identifiants sources, scénario, événement et signal assurent la traçabilité.
- La génération est auditée et le rapport est stocké dans la base Hub nommée.
- Le changement Mongo est additif et optionnel, sans migration destructive.
- Aucune donnée personnelle, secret, dépendance runtime ou nouveau datastore.

## Risques et limites

- Le scénario ne conserve actuellement que sa dernière exécution ; le rapport suit
  ce même modèle et n’introduit pas un faux historique de versions.
- La chronologie technique marque les étapes au temps de fin disponible ; une
  mesure étape par étape nécessiterait une instrumentation ultérieure.
- L’export HTML est destiné à la démonstration et à l’impression, pas à une
  publication institutionnelle.

