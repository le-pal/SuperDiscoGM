# SuperDiscoGM

Maître du Jeu Virtuel — une application où un ou plusieurs joueurs vivent une partie de jeu de rôle (D&D en V1) animée par une IA jouant le rôle de MJ, à partir d'un scénario fourni.

## État du projet

Pré-implémentation : ce dépôt contient la spécification fonctionnelle et une maquette visuelle statique. Il n'y a pas encore de code applicatif.

- **Spécification** : [`doc/index.md`](doc/index.md) — point d'entrée, découpé par lot (admin, scénario, partie, technique) avec décisions actées et questions ouvertes.
- **Maquette visuelle** : [`maquette/index.html`](maquette/index.html) — pages HTML/CSS statiques, à ouvrir directement dans un navigateur (pas de build).

## Stack prévue

Voir [`doc/technique/spec.md`](doc/technique/spec.md) : Next.js + Socket.IO, worker BullMQ, PostgreSQL/Prisma, Redis, Auth.js, déploiement Docker Compose auto-hébergé.
