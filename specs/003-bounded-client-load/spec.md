# Charge bornée, sécurité conservée

2026-09-14 — Lot autorisé : polling chat au premier plan et chargement Hub borné.
Critères : pas de requêtes périodiques sur écran masqué ; pas de chevauchement ;
pas de données d'une ancienne session ; utilisateurs des salons lus en un lot après
contrôle d'appartenance ; trois pages Hub de 100 simultanément au maximum.
JWT, souveraineté, quotas partagés, signatures médias et workflows restent inchangés.
Aucun résultat partiel ne doit être présenté comme complet. Au-delà de 10 000
observations : erreur explicite, jamais fallback simulé.

Hors lot : certification 1 000 utilisateurs, tests de charge production, nouvelle
infrastructure, changement PM2, WebSocket, Redis. Le chargement complet du Hub est
transitoire : résumés serveur et pagination spatiale/par écran restent nécessaires.
