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

## Plateforme de règles générique (prolonge `[Q35]`, voir [architecture-generique.md](architecture-generique.md))

- **Q55.** `[ ]` Où vit la définition d'un `GameSystem` (moteur de règles générique) — formulaire Admin en base, ou fichier de config versionné dans le repo pour commencer ?
- **Q56.** `[ ]` Un Super utilisateur peut-il créer/personnaliser son propre `GameSystem`, ou seulement choisir parmi des systèmes proposés par l'Admin (même logique de droits que les personas, `[Q06]`) ?
- **Q57.** `[ ]` Les champs narratifs d'une fiche (nom du personnage, race, classe en texte libre) : un bucket d'attributs générique défini par le système, ou un bloc "identité" toujours présent, séparé des mécaniques du système ?
- **Q58.** `[ ]` Politique de versionnage d'un `GameSystem` qui change après que des fiches de personnage existent déjà dessus — même esprit que `PromptVersion` (undo-log, `[Q53]`), ou un mécanisme différent (une mécanique de jeu n'est pas un texte librement réversible) ?
- **Q59.** `[ ]` Ce chantier (moteur de règles générique) devient-il un objectif V2 concret, ou reste-t-il en piste V4 (`[Q35]`) le temps que la V1 D&D se stabilise ?
