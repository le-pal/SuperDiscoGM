---
name: simulate-quest
description: Simule une partie de SuperDiscoGM jouée de bout en bout contre un vrai LLM local (Ollama) et une vraie DB, pour vérifier que persistance, tool-calls (dés/fiche/phase), mémoire d'entité et résumés se mettent à jour correctement. Utiliser quand on veut valider un changement au moteur de tour (turnEngine.ts), au pipeline d'ingestion, ou à la persistance inter-scénario d'une campagne (Q10/Q23/Q45/Q47), sans dépendre de Docker.
---

# Simuler une partie jouée

Ce skill orchestre deux scripts déjà écrits (`scripts/test-scenario-ingestion.mts`,
`scripts/simulate-session.mts`) pour dérouler une partie complète — ingestion d'un scénario,
création de joueurs de test, ~20 échanges réalistes joués contre le vrai moteur de tour
(`apps/web/src/server/turnEngine.ts`) — sans jamais passer par Docker : Postgres et Redis
tournent en local via `embedded-postgres`/`redis-memory-server` (npm, voir `scripts/`), le LLM
est un modèle Ollama local.

Ne réécris pas le harnais de simulation en le lisant : appelle les scripts. Ce document explique
la séquence et ce qu'il faut vérifier après coup, pas la logique elle-même (elle vit dans le code
et y bouge — ce fichier ne doit pas être une deuxième source de vérité qui se désynchronise).

## Prérequis

1. **Ollama tourne en local** avec au moins un modèle disposant de `tools` dans ses capacités
   (vérifier `curl http://localhost:11434/api/tags` — `qwen3.5:9b` est celui utilisé jusqu'ici).
   `GlobalSettings.activeProvider`/`activeModel` en DB doivent pointer dessus (le seed les met à
   `ollama`/`qwen3.5:9b` par défaut, cf `packages/db/prisma/seed.ts`).
2. **Postgres embarqué local**, dans un terminal séparé (reste attaché) :
   ```
   node scripts/local-test-db.mjs start
   ```
   Affiche le `DATABASE_URL` à réutiliser pour toutes les commandes suivantes (port 5433, jamais
   le port Docker 5432 — aucun risque de collision avec un déploiement réel).
3. **Redis embarqué local**, dans un autre terminal séparé (reste attaché) :
   ```
   node scripts/local-test-redis.mjs
   ```
   Affiche le `REDIS_URL` (port 6380). **Optionnel mais recommandé** : sans lui, `runMjTurn`
   dégrade proprement (le tour de jeu et la réponse du MJ fonctionnent quand même — seuls les
   jobs asynchrones entity-memory-extraction/summary-consolidation échouent silencieusement,
   loggés en erreur côté appelant, jamais une exception qui remonte). Si tu veux vérifier que la
   mémoire d'entité et les résumés se construisent réellement, Redis doit tourner ET
   `apps/worker` doit consommer la queue (étape 4 ci-dessous) — sans les deux, `EntityMemory`/
   `Summary` resteront vides même si le reste de la simulation réussit.
4. **Migrations à jour contre ce Postgres** (première fois, ou après un changement de schéma) :
   ```
   cd packages/db
   DATABASE_URL="postgresql://superdiscogm:devlocal@localhost:5433/superdiscogm?schema=public" npx prisma migrate dev
   ADMIN_EMAIL=admin@test.local ADMIN_PASSWORD=changeme123 npx tsx prisma/seed.ts
   ```
   (adapter le mot de passe/user si `local-test-db.mjs` a été modifié depuis).
5. **`apps/worker` natif**, dans un terminal séparé, SEULEMENT si tu veux tester la vraie queue
   BullMQ (ingestion, mémoire, résumés) plutôt que des appels directs :
   ```
   DATABASE_URL="..." REDIS_URL="..." OLLAMA_BASE_URL="http://localhost:11434/api" npm run dev --workspace=apps/worker
   ```

N'essaie pas de lancer `apps/web` en même temps pour ce skill — `runMjTurn`/`persistPlayerMessage`
sont appelés directement en TypeScript par `simulate-session.mts`, pas de serveur HTTP nécessaire.
Si un serveur `next dev` tourne déjà sur ce dépôt (une autre session), ignore-le : il n'interfère
pas avec ces scripts qui n'ouvrent aucun port web.

## Séquence

Toutes les commandes suivantes ont besoin de `DATABASE_URL`/`REDIS_URL`/`OLLAMA_BASE_URL` en
variables d'env (celles affichées par les scripts de boot). Exécute depuis la racine du dépôt.

### 1. Ingérer un scénario (si aucun n'est déjà `READY`)

```
npx tsx scripts/test-scenario-ingestion.mts scenario_exemple/Aventure_DCC_pitche.md
```

Affiche `SCENARIO_ID=...` à la fin — le récupérer. Inspecte les phases générées affichées dans la
sortie : titres/résumés pertinents, `npcTags`/`locationTag` non vides pour les scènes qui en ont,
`exitConditions` cohérentes avec le texte source. Si le découpage est hors-sujet ou vide, c'est
généralement un problème de fenêtre de contexte Ollama (`num_ctx`, voir
`packages/llm/src/index.ts`, `buildProviderOptions`) plutôt qu'un problème de prompt — vérifier
`finishReason`/`done_reason` dans les logs du worker avant de toucher au prompt d'ingestion
(`apps/worker/src/workers/ingestion.ts`).

### 2. Simuler une partie (nouvelle campagne)

```
npx tsx scripts/simulate-session.mts <SCENARIO_ID>
```

Crée une campagne, deux joueurs de test avec fiche de personnage, une partie sur la première
phase du scénario, puis déroule ~20 échanges scénarisés (pas des banalités répétées — l'intrigue
avance réellement : incident mécanique, jet de dé forcé, dégâts attendus, relance explicite vers
la sortie de scène). Affiche en fin d'exécution :
- `PARTY_ID=...`, `CAMPAIGN_ID=...`, `USER_IDS=...` — à réutiliser pour l'étape 3.
- Le nombre de `Message` persistés, de `CharacterSheetLog` (tool-calls fiche, avec le détail
  `toolName`/args/résultat), de `DiceRoll`, d'`EntityMemory`, de `Summary`.
- La phase finale de la partie, à comparer à la phase de départ (une transition `advance_phase`
  a eu lieu si elles diffèrent).

### 3. Scénario suivant, même campagne (teste Q10/Q23/Q45/Q47)

Ingère un **second** scénario (étape 1 avec un autre fichier, ex `scenario_exemple/Valjoyeux.md`),
puis :

```
npx tsx scripts/simulate-session.mts <SCENARIO_ID_2> <CAMPAIGN_ID> <USER_IDS>
```

Réutilise la campagne et les joueurs existants (leurs `CharacterSheet` ne sont PAS recréées),
crée une nouvelle `Party` sur le second scénario, rattaché à la même campagne
(`CampaignScenario`, ordre suivant). Vérifie après coup, en base :

- **`Phase` du contexte de tour** (`turnContext.ts`) : les phases injectées dans le prompt du
  second scénario ne doivent contenir QUE celles du second `Scenario.id`, jamais celles du
  premier — le découpage en phases est local au scénario [Q10], pas à la campagne.
- **`EntityMemory` persiste** : `SELECT * FROM "EntityMemory" WHERE "campaignId" = '<CAMPAIGN_ID>'`
  doit encore lister les entités créées pendant le premier scénario (si le worker de mémoire a
  tourné, étape 5 des prérequis) — la mémoire par entité survit au niveau CAMPAGNE et traverse
  les scénarios [Q23][Q45], contrairement au découpage en phases.
- **`CharacterSheet` inchangée entre les deux scénarios** : PV/inventaire/niveau du premier
  scénario doivent se retrouver intacts au début du second (`userId_campaignId` est la clé, pas
  liée au scénario [Q47]) — pas de nouvelle fiche créée pour le second scénario dans les logs de
  `simulate-session.mts` ("Joueur réutilisé", pas "Joueur créé").
- **`Summary` niveau CAMPAIGN** : `SELECT * FROM "Summary" WHERE "campaignId" = '<CAMPAIGN_ID>' AND level = 'CAMPAIGN'`
  a des chances d'exister si le worker de consolidation a tourné sur assez d'échanges — pas
  garanti à tous les coups selon le nombre de tours joués, mais au moins un `Summary` de niveau
  `SESSION` doit exister pour chaque partie si Redis+worker tournaient.

Si l'un de ces points ne tient pas, c'est un bug de persistance inter-scénario à corriger en
priorité (impact direct sur Q23, une décision de spec explicite) — pas un problème de qualité de
simulation.

## Nettoyage

Les données créées par ce skill (`User` avec email `sim-*@test.local`, `Campaign` nommée
`Simulation — <titre>`, et tout ce qui en dépend) sont des données de test, jamais destinées à
une DB de prod. Sur le Postgres embarqué local, pas besoin de nettoyer entre deux runs — chaque
run crée sa propre campagne/ses propres joueurs, `local-test-db.mjs` peut aussi être repartie de
zéro (`node scripts/local-test-db.mjs stop` puis supprimer `.local-pgdata/`) pour un état propre
si le volume de données de test devient gênant.

**Ne jamais lancer ce skill contre une base qui n'est pas `.local-pgdata/`** (vérifier
`DATABASE_URL` avant d'exécuter quoi que ce soit) — les scripts n'ont aucun garde-fou empêchant
de créer des campagnes/joueurs de test dans une base réelle.

## Interpréter un résultat décevant

- **0 `CharacterSheetLog`/`DiceRoll` MJ-initiés après plusieurs tours** avec des situations qui
  appellent clairement un jet ou une conséquence mécanique : suspecter la fiabilité du
  tool-calling du modèle Ollama actif plutôt que le prompt système — certains petits modèles
  respectent mal les schémas d'outils structurés malgré la capacité `tools` annoncée. Essayer un
  autre modèle local (`granite4.1:8b`, `qwen3:8b`) via `GlobalSettings.activeModel` avant de
  réécrire le prompt système (`packages/db/prisma/seed.ts`, `DEFAULT_SYSTEM_PROMPT`).
- **`advance_phase` jamais déclenché** malgré une narration qui remplit manifestement les
  conditions de sortie : le MJ-IA est volontairement conservateur (consigne système : "jamais par
  anticipation") — pousser 2-3 tours de plus avec une formulation encore plus explicite avant de
  conclure à un bug.
- **Erreurs `finishReason: "length"` / JSON tronqué** dans les logs worker : revoir `num_ctx`
  (`packages/llm/src/index.ts`) avant toute autre piste — c'est la cause la plus probable et déjà
  rencontrée une fois sur un scénario long (voir historique git de ce fichier).
