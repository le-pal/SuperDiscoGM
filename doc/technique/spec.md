# Spec — Technique

Retour à [l'index](../index.md).

## Stack technique `[Q36]`

Auto-hébergée sur serveur personnel (Philippe est informaticien, pas de SaaS managé type Vercel/Supabase), portable via Docker.

- **Frontend + temps réel** : Next.js avec un **serveur custom** (fichier `server.js`) auquel Socket.IO est attaché sur le même process HTTP — un seul conteneur `web` sert l'UI, le REST et le WebSocket (rooms par table, présence des connectés `[Q49]`). Évite de partager l'auth/les cookies entre deux origines séparées.
- **Worker asynchrone** : process Node/TS séparé, consommateur BullMQ — porte tout ce qui est explicitement asynchrone dans la spec : ingestion de scénario (`[Q14]`), extraction de mémoire par entité (`[Q42]`), consolidation des résumés hiérarchiques (`[Q22]`). Les réponses du MJ-IA en direct dans le chat restent générées de façon synchrone/streamée dans `web` — pas de queue sur le chemin critique du tour de jeu.
- **Base de données** : PostgreSQL **embarqué dans l'image `web`** (choix explicite de Philippe pour la simplicité d'un seul conteneur — `worker` s'y connecte par le réseau compose interne, port jamais exposé à l'extérieur) + Prisma pour le schéma/les migrations. **Décision assumée comme temporaire : séparation en service dédié prévue plus tard** ("on séparera la DB lors de la V25" — repère volontairement lointain pour dire "pas maintenant"). Migrations versionnées appliquées automatiquement au démarrage du conteneur (`prisma migrate deploy`, équivalent Flyway — jamais `migrate dev` en dehors du poste de dev).
- **Fichiers de scénario** : stockés en base (blob), pas de stockage objet en V1 — cohérent avec l'absence d'images de contenu en V1 (`[Q13b]`), les fichiers restent texte-lourds donc raisonnables en taille. **Point de bascule explicite** : dès que V2/V3 introduisent des images (avatars personnalisés `[Q50]`, cartes `[Q34]`), migrer vers un stockage objet (ex: MinIO) — le blob-en-DB ne passera pas à l'échelle des binaires images.
- **File de jobs** : Redis + BullMQ.
- **Authentification** : Auth.js v5 (maintenu activement, adapter Prisma officiel) + flux d'invitation par lien fait maison, pour éviter de recoder l'auth à la main. `[Q38]`
- **Déploiement** : un `docker-compose.yml` (`web` avec Postgres embarqué, `worker`, `redis`) + reverse proxy Caddy (TLS automatique) devant `web`. **Sauvegarde `pg_dump` planifiée dès la V1** — la conteneurisation ne remplace pas une sauvegarde, l'historique de campagne et les fiches perso n'ont pas de filet sinon. **Validé bout en bout** : build Docker + migrations + seed + page lisant la DB au runtime fonctionnent (voir [architecture.md](architecture.md)).
- **Observabilité** : logs structurés sur stdout (captés par Docker) suffisent en V1 ; monitoring dédié (Grafana/Prometheus) explicitement différé, pas oublié.

## Fournisseur(s) LLM `[Q37]`

- **Architecture multi-fournisseurs dès la conception**, via le Vercel AI SDK (package `ai` — open-source, MIT, aucune dépendance à l'hébergement Vercel malgré le nom) : abstraction unifiée + tool-calling natif au-dessus d'Anthropic, OpenAI, Ollama, etc. Sélection du modèle actif : droit de l'Admin, voir [admin/spec.md](../admin/spec.md).
- **Séquence de développement actée par Philippe** : développement initial sur **Ollama en local avec un petit modèle** (itération rapide, gratuite), puis bascule sur de **gros modèles** (cloud) pour la suite.
  - Choisir un modèle Ollama qui supporte réellement le function-calling — sinon le chemin de code tool-calling n'est même pas exercé en dev. **Installé sur le poste de Philippe : `qwen3.5:9b`** (Q4_K_M, ~6,6 Go, contexte 262144) — support `tools` confirmé via `ollama show`, choisi après audit comparatif face à `qwen3:8b` et `granite4.1:8b` (même lignée tool-calling que qwen3:8b mais génération plus récente et contexte natif 6× plus grand, utile pour la mémoire hiérarchique — `[Q22]`). Tient confortablement dans les 12 Go VRAM d'une RTX 4070 desktop (~5,4 Go de marge).
  - **Point de vigilance : le tool-calling est nettement moins fiable sur les petits modèles locaux** que sur les gros modèles cloud, alors que l'architecture en dépend structurellement pour tout ce qui doit rester déterministe (dés `[Q32]`, moteur de règles `[Q32b]`, mise à jour de fiche `[Q31b]`). Ce qui fonctionne en dev sur Ollama ne valide donc pas ces flux — à revalider explicitement contre le modèle cible de production avant de considérer une fonctionnalité tool-calling comme terminée.
  - `ollama` tourne en conteneur additionnel, profil docker-compose **dev uniquement** (pas en prod).
- **Authentification : email/mot de passe + invitation par lien** pour rejoindre une table sans que l'Admin crée chaque compte manuellement. `[Q38]`
- **RGPD / rétention des données : pas prioritaire en V1**, à reprendre impérativement avant toute ouverture publique de l'app. `[Q39]`
- **Hébergement / échelle cible V1 : usage perso / petit groupe**, pas de mise en production publique à grande échelle pour l'instant. `[Q40]`
