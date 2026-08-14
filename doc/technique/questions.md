# Questions — Technique

Retour à [l'index](../index.md). Statut : `[ ]` ouverte · `[x]` tranchée (voir [spec.md](spec.md)).

- **Q36.** `[x]` Stack front/back envisagée ?
  → **Décision : self-hosted sur serveur personnel, Docker Compose, aucun SaaS managé** (Philippe est informaticien, préfère garder le contrôle). Next.js avec serveur custom + Socket.IO (un seul conteneur `web`), worker BullMQ séparé pour l'asynchrone, PostgreSQL en service séparé + Prisma, Redis, auth maison, reverse proxy Caddy/Traefik. Détail complet et justifications dans [spec.md](spec.md). Écarté en cours de route : Lucia Auth puis next-auth v5 (même motif : beta/abandon prolongé — voir auth maison ci-dessous), Supabase/MinIO (dépendance SaaS / composant en trop pour la V1 — fichiers stockés en base pour l'instant, avec point de bascule documenté), Postgres embarqué dans l'image web (démarrage trop lent en pratique, séparé).
- **Q37.** `[x]` Fournisseur(s) LLM — un seul ou plusieurs ?
  → **Décision : architecture multi-fournisseurs dès la conception** (Vercel AI SDK), cohérent avec "l'Admin choisit les modèles" du brief initial. **Séquence actée : dev sur Ollama local (petit modèle) puis bascule sur de gros modèles cloud.** Le tool-calling étant moins fiable sur petit modèle local, les flux critiques (dés, fiche perso) devront être revalidés contre le modèle cible de prod avant d'être considérés terminés — voir [spec.md](spec.md).
- **Q38.** `[x]` Authentification des utilisateurs ?
  → **Décision : email/mot de passe + invitation par lien.** Comptes classiques pour les rôles gérés par l'Admin, et un système d'invitation par lien pour qu'un Super utilisateur ajoute facilement des joueurs à sa table sans que l'Admin crée chaque compte manuellement.
- **Q39.** `[x]` RGPD : politique de rétention/suppression à prévoir dès la V1 ?
  → **Décision : pas prioritaire en V1**, cohérent avec l'échelle "usage perso/petit groupe" (`[Q40]`). À reprendre impérativement avant toute ouverture publique de l'app.
- **Q40.** `[x]` Hébergement / échelle cible pour la V1 ?
  → **Décision : usage perso / petit groupe.** La V1 ne vise pas une mise en production publique à grande échelle, ce qui permet de rester simple sur l'infra au départ (cohérent avec le multi-tenant déjà acté en `[Q02]`, mais à échelle restreinte).
