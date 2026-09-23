# Scénario de démonstration paramétrable

2026-09-23 — Fonctionnalité demandée par le propriétaire.

Un administrateur Hub doit pouvoir paramétrer la simulation intersectorielle avant
son exécution : choisir un État source, un autre État à comparer et une période.
Le Hub génère ensuite un jeu de démonstration explicitement fictif pour les trois
flux obligatoires DHIS2, ARIS 3 et CAPC-AC, rapproche les observations, crée un
signal à vérifier et produit un rapport de simulation traçable.

Le paramétrage ne transforme jamais la simulation en alerte officielle et ne
permet pas au navigateur de décider des autorisations ou de la souveraineté.

## Critères d’acceptation

- Les deux pays appartiennent aux onze États CEEAC et doivent être distincts.
- Les dates utilisent le format ISO `YYYY-MM-DD`, ne sont pas futures, sont dans
  l’ordre et couvrent au maximum 90 jours inclus.
- Les trois secteurs et leurs sources restent imposés par le serveur pour cette
  première version afin de garantir un scénario réellement intersectoriel.
- L’API reconstruit et valide toute la configuration, puis l’enregistre avec
  l’exécution, l’audit et le rapport ; elle ne fait pas confiance aux libellés du
  client.
- Chaque combinaison pays/période possède des identifiants déterministes et
  rejouables, sans duplication silencieuse des observations.
- L’interface présente la configuration avant le loader, bloque les doubles
  soumissions et rappelle partout que les données sont simulées.
- Le rapport restitue les pays et la période réellement choisis.
- Les anciennes exécutions Cameroun–Tchad et leurs rapports restent lisibles.

## Hors périmètre MVP

- sélection arbitraire d’un seul secteur ou d’une source non homologuée ;
- requêtes directes vers les plateformes nationales réelles ;
- validation automatique d’une alerte ou publication institutionnelle ;
- sélection de plus de deux pays dans une même exécution.
