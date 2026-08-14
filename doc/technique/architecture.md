# Architecture — SuperDiscoGM

Retour à [l'index](../index.md) · [spec technique](spec.md).

Vue d'ensemble des composants décidés dans `spec.md`, et de comment ils s'articulent. À valider avant de poursuivre l'implémentation.

```mermaid
flowchart TB
    subgraph Client["Navigateur"]
        UI["UI Next.js<br/>(joueurs, MJ humain = Super utilisateur, Admin)"]
    end

    subgraph WebProc["apps/web — un seul process/conteneur"]
        Next["Next.js<br/>pages + Route Handlers (REST/BFF)"]
        Socket["Socket.IO<br/>chat temps réel + présence"]
        LLMLive["Appel LLM synchrone<br/>(réponse MJ-IA en direct, streamée)"]
    end

    subgraph WorkerProc["apps/worker — process séparé"]
        BullMQ["Workers BullMQ"]
        JobIngest["job: ingestion de scénario [Q14]"]
        JobEntity["job: extraction mémoire par entité [Q42]"]
        JobSummary["job: consolidation résumés [Q22]"]
    end

    PG[("PostgreSQL<br/>(via packages/db · Prisma)")]
    Redis[("Redis<br/>(file BullMQ)")]
    LLM{{"Fournisseur LLM<br/>(package ai)<br/>dev: Ollama local · prod: gros modèle cloud"}}

    UI <-->|HTTP| Next
    UI <-->|WebSocket| Socket
    Next --> PG
    Socket --> PG
    Socket --> LLMLive
    LLMLive --> LLM
    Next -->|enqueue job| Redis
    Redis --> BullMQ
    BullMQ --> JobIngest & JobEntity & JobSummary
    JobIngest & JobEntity & JobSummary --> PG
    JobIngest & JobEntity & JobSummary -.->|appel LLM async, task #7| LLM

    style WebProc fill:#1b1e2a,stroke:#e0a955,color:#e8e6e3
    style WorkerProc fill:#1b1e2a,stroke:#6c63b5,color:#e8e6e3
```

## Pourquoi ce découpage

- **Un seul process pour `web`** (Next.js + Socket.IO sur le même serveur HTTP custom) : évite de partager l'auth/les cookies entre deux origines séparées. Voir `spec.md` § Stack technique pour la justification complète (challengée avec Philippe avant de coder).
- **`worker` séparé** : ne porte que ce qui est *explicitement* asynchrone dans la spec fonctionnelle — l'ingestion de scénario, l'extraction mémoire, la consolidation de résumés. **La réponse du MJ-IA en direct dans le chat ne passe jamais par une queue** : elle doit rester synchrone/streamée pour ne pas casser le rythme de jeu.
- **`packages/db`** : schéma Prisma partagé, source unique de vérité du modèle de données pour `web` et `worker`.
- **`packages/jobs`** : contrats partagés (noms de queue + types de payload) entre le producteur (`web`, qui enqueue) et le consommateur (`worker`) — évite une désynchronisation silencieuse entre les deux process.
- **Confidentialité du party split [Q26]** : appliquée côté serveur dans `socket.ts` — un message privé est émis uniquement vers les rooms `user:<id>` des destinataires autorisés, jamais diffusé puis filtré côté client.

## Flux clés

1. **Tour de jeu normal** : joueur → Socket.IO → MJ-IA génère la réponse (appel LLM synchrone, streamé) → diffusion (room `party:x` publique, ou rooms `user:x` ciblées si aparté privé) → persistance `Message` en DB.
2. **Ingestion de scénario** : Super utilisateur lance l'analyse → `web` enqueue un job `scenario-ingestion` → `worker` le consomme, appelle le LLM (task #7, pas encore câblé), écrit les `Phase`, notifie.
3. **Mémoire par entité** : après un échange marquant → job `entity-memory-extraction` → `worker` met à jour `EntityMemory` + `EntityMemoryIndexEntry`.
4. **Résumés hiérarchiques** : job `summary-consolidation` → `worker` met à jour `Summary` (niveau SESSION / ARC / CAMPAIGN).

## Ce qui est déjà scaffoldé vs pas encore

| Composant | État |
|---|---|
| `apps/web` — Next.js + serveur custom + Socket.IO | ✅ scaffoldé, testé (boot + HTTP 200) |
| `packages/db` — schéma Prisma complet | ✅ scaffoldé (pas encore migré sur une vraie DB) |
| `apps/worker` — 3 workers BullMQ | 🚧 scaffoldé avec des stubs (pas d'appel LLM réel) |
| `packages/jobs` — contrats de queue partagés | ✅ scaffoldé |
| Docker Compose (web/worker/postgres/redis/ollama) | ❌ pas commencé |
| Auth.js v5 | ❌ pas commencé |
| Abstraction LLM multi-fournisseurs (`ai`) | ❌ pas commencé — tout ce qui touche au LLM est un stub pour l'instant |
| Pages réelles (portage de la maquette en composants React) | ❌ pas commencé |
