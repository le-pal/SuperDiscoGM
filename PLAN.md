# PLAN.md — Reprise de l'implémentation SuperDiscoGM

Ce document est le point d'entrée pour reprendre le développement là où il en est réellement,
sans dépendre de la mémoire d'une conversation précédente. Il a été écrit le **2026-08-14** en
comparant la spec (`doc/`) et l'architecture décidée (`doc/technique/architecture.md`) au **code
réel** du repo — pas seulement à ce que la doc annonce.

**Avant de coder quoi que ce soit** : relire `doc/index.md`, les 4 `spec.md` de lot
(`doc/admin/`, `doc/scenario/`, `doc/partie/`, `doc/technique/`), `doc/roadmap.md` et
`doc/technique/architecture.md`. C'est la seule source de vérité produit. Ce plan ne réexplique
pas les décisions actées, il y renvoie par `[Qxx]`. Si un point n'est pas tranché dans `doc/`, ce
plan écrit explicitement `TBD [Qxx]` — ne comble jamais un TBD par une supposition personnelle
sans le signaler.

**Pour reprendre le travail : va directement au tableau de suivi en fin de document.** C'est la
photographie la plus à jour de l'état réel constaté.

---

## 1. État des lieux (vérifié contre le code)

### 1.1 Fonctionne bout en bout (vérifié dans le code, pas seulement annoncé)

- **Monorepo** : `apps/web`, `apps/worker`, `packages/db`, `packages/llm`, `packages/jobs`, npm
  workspaces (`package.json` racine).
- **Docker Compose** (`docker-compose.yml`) : `postgres` (service séparé, `postgres:16-alpine`),
  `migrate` (one-shot, `prisma migrate deploy` + seed), `web`, `worker`, `redis`, `caddy`
  (reverse proxy, ports 80/443), profil `ollama` en dev uniquement. Conforme à
  `doc/technique/spec.md` et `architecture.md`.
- **`packages/db`** : schéma Prisma 7 complet (voir §1.4), driver adapter `@prisma/adapter-pg`,
  3 migrations générées (`20260814134941_init`, `20260814143210_summary_index_not_unique`,
  `20260814144910_add_session`), `seed.ts` (GlobalSettings + Admin de bootstrap idempotent).
- **Auth maison** `[Q38]` : `apps/web/src/server/auth.ts` (session opaque en DB, `tokenHash`,
  cookie httpOnly), `apps/web/src/proxy.ts` (garde léger cookie), routes
  `POST /api/auth/login` et `POST /api/auth/logout`, page `/login` fonctionnelle (style minimal,
  pas la maquette). Flux d'**acceptation** d'invitation fonctionnel : `/invite/[token]` +
  `POST /api/invite/accept` (crée le compte avec le rôle porté par l'invitation).
- **`apps/web/server.ts`** : serveur HTTP custom (Next.js + Socket.IO sur le même process),
  conforme à la décision `[Q36]` d'éviter deux origines séparées pour l'auth/cookies.
- **`packages/llm`** : abstraction multi-fournisseurs (`resolveModel`/`getConfiguredModel`, lit
  `GlobalSettings.activeProvider`/`activeModel`) au-dessus du package `ai`, Anthropic/OpenAI/
  Ollama. Outil `roll_dice` déterministe (RNG serveur, jamais le LLM) `[Q32]`.
- **`apps/worker/src/workers/ingestion.ts`** : pipeline d'ingestion de scénario **réellement
  branché sur un appel LLM** (`generateObject`, schéma zod des phases) — mais pas encore testé
  contre un Ollama qui tourne réellement (confirmé par `architecture.md`, pas revérifié ici).

### 1.2 Scaffoldé mais stub / partiel (le squelette existe, la logique métier non)

- `apps/web/src/server/socket.ts` : serveur Socket.IO avec rooms `party:<id>`/`user:<id>`,
  logique de confidentialité du party split déjà écrite côté serveur `[Q26]`, présence de base
  (`party:presence`). **Mais** l'identité de l'utilisateur socket vient d'un
  `socket.handshake.auth.userId` envoyé librement par le client — un `TODO` explicite dans le
  code (`// TODO [task Auth.js — #6]`) dit noir sur blanc que ce n'est pas fiable et doit être
  remplacé par la session réelle avant d'aller plus loin. **Aucun client ne consomme ce serveur
  aujourd'hui** — pas de page qui ouvre une connexion Socket.IO.
- `apps/worker/src/workers/entityMemory.ts` : squelette complet (lecture des messages, upsert
  `EntityMemory`, création `EntityMemoryIndexEntry`), mais `detectedEntities` est un tableau vide
  codé en dur — **aucune extraction LLM réelle**, `TODO [task #7]` explicite dans le fichier.
- `apps/worker/src/workers/summaries.ts` : squelette complet (dédup `findFirst`+create/update,
  justifié en commentaire par l'absence d'`@@unique` sur `Summary` — NULL n'est jamais égal à
  NULL en SQL), mais `content` est une chaîne placeholder codée en dur — **aucune consolidation
  LLM réelle**, `TODO [task #7]` explicite.

### 1.3 N'existe pas du tout

- Aucune page réelle en dehors de `/login`, `/invite/[token]` et la page d'accueil "hello world"
  (`apps/web/src/app/page.tsx`, qui affiche juste l'utilisateur connecté + le provider LLM actif).
  **Aucun écran de la maquette (`maquette/*.html`) n'est porté en React** : dashboard, écran de
  partie (chat), fiche de personnage, admin, ingestion de scénario, profil — tout reste à faire.
- Aucune route API pour : créer une campagne, créer/uploader un scénario, déclencher l'analyse,
  créer/rejoindre/reprendre une partie, émettre une invitation (seule l'**acceptation** existe),
  lire/modifier une fiche de personnage, écrire un message de chat (le modèle `Message` existe,
  rien ne le peuple), gérer les personas, modifier `GlobalSettings` (prompt système, modèle LLM
  actif, budget).
- **Aucun appel LLM synchrone/streamé pour un tour de jeu en direct** — `packages/llm` n'est
  utilisé aujourd'hui que par le worker d'ingestion (asynchrone). Le cœur du gameplay (le MJ-IA
  qui répond en direct dans le chat) n'a pas une ligne de code.
- Aucun outil (tool-call) au-delà de `roll_dice` : pas de moteur de règles (CA, dégâts,
  emplacements de sorts, conditions `[Q32b]`), pas de tool de mise à jour de fiche
  (`apply_damage`, `add_item`, `level_up` — noms déjà mentionnés en commentaire dans
  `schema.prisma` mais aucune implémentation).
- Aucun test automatisé dans le repo (`find . -iname "*.test.ts" -o -iname "*.spec.ts"` ne
  retourne rien hors `node_modules`).
- Aucune sauvegarde `pg_dump` planifiée dans `docker-compose.yml` malgré la décision actée dans
  `doc/technique/spec.md` ("Sauvegarde `pg_dump` planifiée dès la V1") — voir §1.5.

### 1.4 Modèle de données (`packages/db/prisma/schema.prisma`)

Le schéma est **complet pour la V1** et couvre déjà tout ce que la spec décrit : `User`/`Role`,
`Session`, `Invitation`, `Campaign`/`Scenario`/`CampaignScenario`/`ScenarioFile`, `Phase`,
`Persona`, `GlobalSettings`, `Party`/`PartyParticipant`, `CharacterSheet`/`CharacterSheetLog`,
`PlayerNote`, `Message`, `DiceRoll`, `EntityMemory`/`EntityMemoryIndexEntry`, `Summary`. Le
travail restant n'est donc **pas** un travail de modélisation de données mais de **branchement**
(API, UI, logique métier, appels LLM) au-dessus d'un schéma déjà solide. Ne pas re-designer le
schéma sans une raison concrète rencontrée en implémentant.

### 1.5 Écarts constatés entre la doc et le code réel

- `doc/technique/spec.md` affirme la décision "**Sauvegarde `pg_dump` planifiée dès la V1**" mais
  **rien dans `docker-compose.yml` ni les Dockerfiles ne l'implémente** (pas de service cron, pas
  de script, pas de volume de sauvegarde). C'est une décision actée mais pas scaffoldée — traitée
  comme étape 21 ci-dessous.
- `doc/technique/architecture.md` (tableau "déjà scaffoldé vs pas encore") est globalement fidèle
  au code réel constaté ici, à une nuance près : il classe `packages/llm` "✅ scaffoldé, branché
  dans `ingestion.ts`" sans préciser que **rien n'utilise `packages/llm` pour un tour de jeu
  synchrone** — seul le chemin asynchrone (ingestion) est câblé. C'est cohérent avec la spec (le
  chemin synchrone n'est pas encore commencé), mais à ne pas lire comme "le LLM est branché dans
  le jeu".
- Le `TODO [task Auth.js — #6]` dans `socket.ts` et les `TODO [task #7]` dans `entityMemory.ts`/
  `summaries.ts` sont des marqueurs de continuité déjà posés par une session précédente — ce plan
  les reprend explicitement (étapes 1, 13, 14) plutôt que de les ignorer.

---

## 2. Étapes vers une V1 jouable

Ordre de dépendance réel — ne pas paralléliser au-delà de ce que les dépendances permettent
(ex : ne pas porter l'écran de partie avant que la fiche de personnage et l'auth socket réelle
existent). Chaque étape indique ses dépendances, ce qu'il faut faire, les fichiers concernés, les
décisions à respecter, et une complexité **S/M/L**.

### Étape 1 — Authentification réelle du socket
**Dépend de** : rien (auth HTTP déjà faite). **Bloque** : 7, 8, 9.
Remplacer le `socket.handshake.auth.userId` (TODO explicite, non fiable) par une vérification de
la session réelle au handshake — réutiliser la logique de `apps/web/src/server/auth.ts`
(`getCurrentUser`/lecture de `Session` en DB) en passant le cookie de session au handshake
Socket.IO plutôt qu'un `userId` déclaré librement par le client.
**Fichiers** : `apps/web/src/server/socket.ts`, `apps/web/src/server/auth.ts`, `apps/web/server.ts`.
**Complexité** : S.

### Étape 2 — Émission d'invitation (créer, pas seulement accepter)
**Dépend de** : rien. **Bloque** : 6 (dashboard doit pouvoir inviter), usage normal du produit.
Seule l'**acceptation** d'invitation existe (`/api/invite/accept`). Il manque la création : un
Super utilisateur (ou Admin par héritage `[Q04]`) génère un lien pour une campagne donnée avec un
rôle cible, `TODO`-like actuellement absent du code mais implicite dans `Invitation` (le modèle a
déjà `token`, `campaignId`, `invitedById`, `role`, `expiresAt`).
**Fichiers** : nouvelle route `POST /api/campaigns/[id]/invitations` (ou équivalent), UI minimale
(peut être intégrée à l'étape 3 ou 16).
**Décisions à respecter** : `[Q05]` (droit Super utilisateur), `[Q38]` (flux d'invitation par lien).
**Complexité** : S.

### Étape 3 — Gestion des campagnes (CRUD minimal)
**Dépend de** : rien. **Bloque** : 4, 5, 17.
Créer/lister les campagnes (Super utilisateur, Admin par héritage), assigner une surcharge de
persona au niveau campagne (le champ `Campaign.personaId` existe déjà).
**Fichiers** : routes `app/api/campaigns/*`, pages nouvelles (pas de maquette dédiée — dérive du
dashboard/admin).
**Décisions à respecter** : `[Q05]`, `[Q10]`, `[Q12]` (groupe de joueurs souple).
**Complexité** : M.

### Étape 4 — Scénarios : upload/texte + déclenchement de l'analyse
**Dépend de** : 3. **Bloque** : 5.
Porter `maquette/ingestion-scenario.html`. Créer un scénario (texte collé ou upload PDF/docx/
markdown — extraction texte uniquement, images ignorées mais le modèle `ScenarioFile.data: Bytes`
est déjà prêt à les accueillir plus tard `[Q13b]`), déclencher la commande d'analyse qui enqueue
le job `scenario-ingestion` (`packages/jobs`, déjà consommé par `apps/worker/src/workers/
ingestion.ts` — ce bout existe déjà côté worker, il manque le producteur côté `web`). Afficher le
statut (`DRAFT`/`ANALYZING`/`READY`) et les phases digérées une fois prêtes. Permettre la
modification post-hoc avec ré-analyse `[Q18]` (une partie en cours continue sur l'ancien
découpage — à garder en tête dans le design de la route, pas seulement l'UI).
**Fichiers** : routes `app/api/scenarios/*`, page(s) dérivées de `maquette/ingestion-scenario.html`.
**Décisions à respecter** : `[Q13]`, `[Q13b]`, `[Q14]` (async + notification — la notification
réelle est l'étape 15), `[Q15]` (pas de validation humaine obligatoire), `[Q16]`, `[Q18]`.
**Complexité** : L.

### Étape 5 — Parties (sessions) : création, rejoindre, reprendre
**Dépend de** : 3, 4. **Bloque** : 6, 7.
Un Super utilisateur lance une partie sur un couple campagne+scénario ; un utilisateur rejoint via
son invitation/dashboard ; reprendre une partie recharge l'état exact (`currentPhaseId`, résumé,
mémoire d'entités — les deux derniers viennent des étapes 13/14).
**Fichiers** : routes `app/api/parties/*`.
**Décisions à respecter** : `[Q11]`.
**Complexité** : M.

### Étape 6 — Tableau de bord
**Dépend de** : 2, 3, 5. **Bloque** : rien de bloquant en aval, mais nécessaire pour un usage réel.
Porter `maquette/dashboard.html`. Liste des parties rejointes par l'utilisateur (multi-parties
simultanées `[Q48]`), indicateur de présence utilisant l'événement `party:presence` déjà émis par
`socket.ts`. La mécanique précise de l'indicateur (liste nominative vs compteur, notification
d'arrivée) est `TBD [Q49b]` — choisir une implémentation simple et documenter que c'est
provisoire en attendant que `Q49b` soit tranchée, ne pas sur-construire dessus.
**Fichiers** : nouvelle page dashboard (React), consommation du client Socket.IO.
**Décisions à respecter** : `[Q48]`, `[Q49]` (décidé), `TBD [Q49b]` (mécanique précise).
**Complexité** : L.

### Étape 7 — Écran de partie : chat temps réel
**Dépend de** : 1, 5. **Bloque** : 8, 11, 12, 20.
Porter `maquette/ecran-partie.html`. Client Socket.IO connecté à la room `party:<id>`, envoi/
réception de `chat:message`, **persistance en DB du `Message`** (aujourd'hui rien n'écrit dans ce
modèle — à faire soit dans le handler socket serveur, soit via une route API appelée avant
l'émission). Couleur de contour par utilisateur (`User.avatarColor`, déjà en DB). Repère système
visible par tous signalant un aparté party split, sans révéler le contenu `[Q26]`, reveal manuel
par le MJ-IA `[Q26b]` (le reveal peut rester un souci de l'étape 8, ce tour-ci ne fait que
l'affichage). Historique en scroll infini uniquement `[Q29]` (pas d'export).
**Fichiers** : nouvelle page écran de partie, client Socket.IO (`apps/web/src/app/...`),
éventuellement une route API `POST /api/parties/[id]/messages`.
**Décisions à respecter** : `[Q25]`, `[Q26]`, `[Q26b]`, `[Q27]` (préparer la place pour les
actions structurées, implémentées à l'étape 12), `[Q29]`.
**Complexité** : L.

### Étape 8 — Boucle de jeu MJ-IA (le cœur du gameplay, cœur de tout le produit)
**Dépend de** : 1, 7 (le chat doit exister pour y brancher une réponse). **Bloque** : 9, 10, 13, 14.
Rien n'existe encore ici — c'est l'étape la plus importante du plan. À chaque tour :
1. Assembler le contexte à partir des blocs distincts décrits dans `doc/scenario/spec.md` §Gestion
   du contexte : scénario digéré (Phase active), résumé de la partie, journal des actions
   importantes (schéma `TBD [Q21b]` — voir note ci-dessous), prompt système + persona (résolution
   scénario > campagne > persona globale par défaut `[Q06]`, composée par-dessus le prompt système
   global jamais en remplacement `[Q24]`), fenêtre glissante des derniers échanges.
2. Ordre de troncature si dépassement du budget de contexte : **dernières conversations d'abord**,
   tout le reste reste prioritaire `[Q19]`.
3. Appel LLM **synchrone et streamé** (jamais via une queue BullMQ — `packages/llm` déjà prêt côté
   fournisseur, à appeler ici pour la première fois en mode chat) ; publication de la réponse MJ-IA
   dans le chat (room `party:<id>` ou rooms `user:<id>` ciblées si aparté).
4. Note sur `[Q21b]` (`TBD`) : le schéma de données du journal d'actions importantes n'est pas
   tranché dans la doc (liste d'événements typés ? journal de quêtes ? timeline ?). Ne pas
   trancher soi-même silencieusement — proposer une structure minimale explicitement documentée
   comme provisoire, ou remonter la question avant d'implémenter si le choix a un impact fort sur
   le reste de l'architecture de contexte.
**Fichiers** : nouveau module côté `apps/web` (ex. `apps/web/src/server/gm-turn.ts`), branché sur
le handler `chat:message` de `apps/web/src/server/socket.ts`, réutilise `packages/llm`.
**Décisions à respecter** : `[Q19]`, `[Q20]`, `[Q21]`, `TBD [Q21b]`, `[Q06]`, `[Q24]`.
**Complexité** : L (probablement la plus grosse étape du plan).

### Étape 9 — Détection de transition de phase
**Dépend de** : 8. **Bloque** : rien en aval.
Le MJ-IA compare automatiquement la conversation en cours aux `exitConditions` de la `Phase`
active et avance `Party.currentPhaseId` quand c'est rempli. Peut être implémenté comme une étape
du même appel LLM que l'étape 8 (ex. un tool-call dédié) plutôt qu'un second appel séparé.
**Fichiers** : `apps/web/src/server/gm-turn.ts` (ou équivalent), éventuellement un nouvel outil
dans `packages/llm/src/tools/`.
**Décisions à respecter** : `[Q17]`.
**Complexité** : M.

### Étape 10 — Outils dés & moteur de règles complet
**Dépend de** : 8 (a besoin d'un appel LLM avec tool-calling en place pour être exercé). **Bloque** : 11.
`roll_dice` existe déjà (`packages/llm/src/tools/dice.ts`) et sert de patron. Il manque : le
moteur de règles complet (CA, calcul de dégâts, consommation d'emplacements de sorts, application
de conditions) et les outils de mise à jour de fiche (`apply_damage`, `add_item`, `level_up` —
noms déjà anticipés dans le commentaire de `CharacterSheetLog.toolName` du schéma). **Chaque
outil doit écrire dans `CharacterSheetLog`** (traçabilité, `argsJson`/`resultJson`) et **jamais
laisser le résultat au texte libre du LLM** — la narration suit ce qui a été appliqué, jamais
l'inverse.
**Point de vigilance explicite de la spec** : le tool-calling est nettement moins fiable sur les
petits modèles Ollama de dev que sur les gros modèles cloud — ce qui fonctionne en dev sur Ollama
ne valide pas ces flux ; revalider contre le modèle cible de production avant de considérer ces
outils comme terminés `[doc/technique/spec.md §Fournisseur(s) LLM]`.
**Fichiers** : `packages/llm/src/tools/*` (nouveaux fichiers), `packages/llm/src/index.ts`
(exports), `apps/web/src/server/gm-turn.ts` (branchement).
**Décisions à respecter** : `[Q31b]`, `[Q32]`, `[Q32b]`.
**Complexité** : L.

### Étape 11 — Fiche de personnage (UI)
**Dépend de** : 7, 10. **Bloque** : rien de bloquant, mais nécessaire pour un joueur puisse voir sa
fiche.
Porter `maquette/fiche-personnage.html`. Version simplifiée V1 (PV, quelques traits clés) `[Q30]`,
liée à la campagne (pas au scénario, `CharacterSheet.campaignId` déjà en DB `[Q47]`). Le joueur
garde la main sur ses choix propres (montée de niveau) — distinguer dans l'UI ce qui est éditable
par le joueur de ce qui n'est mis à jour que par le MJ-IA via tool-call `[Q31]`.
**Fichiers** : nouvelle page dérivée de `maquette/fiche-personnage.html`, route
`app/api/character-sheets/*` (lecture ; écriture réservée aux tool-calls de l'étape 10 côté
serveur, pas une route ouverte au joueur pour tout modifier librement).
**Décisions à respecter** : `[Q30]`, `[Q31]`, `[Q31b]`, `[Q47]`.
**Complexité** : M.

### Étape 12 — Actions structurées dans le chat
**Dépend de** : 7, 10. **Bloque** : rien.
`/roll` et sélection de sort/objet depuis l'écran de partie. Un jet non sollicité par un joueur
peut être annoncé dans le chat mais le MJ-IA reste libre de l'ignorer `[Q32c]` — ne pas lui donner
de portée automatique sur la narration.
**Fichiers** : écran de partie (étape 7), appel direct à `rollDiceTool`/outils de l'étape 10 côté
joueur (pas uniquement déclenché par le MJ-IA).
**Décisions à respecter** : `[Q27]`, `[Q32]`, `[Q32c]`.
**Complexité** : M.

### Étape 13 — Mémoire par entité : vraie extraction LLM
**Dépend de** : 8. **Bloque** : amélioration de la qualité du contexte de l'étape 8, pas un
bloqueur dur pour un premier jouable.
Remplacer le stub `detectedEntities = []` de `apps/worker/src/workers/entityMemory.ts` par un
vrai appel LLM qui identifie PNJ/lieux/factions/quêtes dans la plage de messages et met à jour la
fiche résumé courte. Implémenter le **modèle de récupération en deux temps** `[Q44]` côté étape 8 :
la fiche résumé de chaque entité pertinente à la scène active toujours injectée par défaut, le
détail brut (via `EntityMemoryIndexEntry`) récupéré à la demande seulement.
**Fichiers** : `apps/worker/src/workers/entityMemory.ts`, `apps/web/src/server/gm-turn.ts` (côté
injection).
**Décisions à respecter** : `[Q41]`, `[Q42]`, `[Q43]`, `[Q44]`, `[Q45]`.
**Complexité** : L.

### Étape 14 — Résumés hiérarchiques : vraie consolidation LLM
**Dépend de** : 8. **Bloque** : rien de bloquant pour un premier jouable, améliore la tenue en
longue campagne.
Remplacer le `content` placeholder de `apps/worker/src/workers/summaries.ts` par une vraie
consolidation LLM à 3 niveaux (session → arc/scénario → campagne).
**Fichiers** : `apps/worker/src/workers/summaries.ts`.
**Décisions à respecter** : `[Q22]`.
**Complexité** : M.

### Étape 15 — Notification de fin d'ingestion
**Dépend de** : 1, 4. **Bloque** : rien, complète l'étape 4.
`apps/worker/src/workers/ingestion.ts` a un `TODO` explicite : notifier le Super utilisateur à la
fin du job. Implémenter via pub/sub Redis relayé par `apps/web` vers la room `user:<id>`
correspondante (le worker n'a pas de connexion Socket.IO directe, `web` si).
**Fichiers** : `apps/worker/src/workers/ingestion.ts`, `apps/web/src/server/socket.ts` (ou un
petit module de relais dédié).
**Décisions à respecter** : `[Q14]`.
**Complexité** : S.

### Étape 16 — Administration
**Dépend de** : rien de bloquant techniquement, mais logique après 3 (les campagnes existent).
Porter `maquette/admin.html`. Prompt système global `[Q09]`, sélection du fournisseur/modèle LLM
actif `[Q37]` (écrit dans `GlobalSettings`, déjà lu par `packages/llm`), gestion des utilisateurs
et rôles `[Q04]`, budget `[Q03]`.
**Fichiers** : nouvelle page admin, routes `app/api/admin/*`.
**Décisions à respecter** : `[Q03]`, `[Q04]`, `[Q09]`, `[Q37]`.
**Complexité** : M/L.

### Étape 17 — Persona MJ (CRUD + résolution)
**Dépend de** : 3, 16. **Bloque** : rien.
Bibliothèque globale de personas (genre/type de jeu), gérée par le Super utilisateur, surcharge
possible au niveau campagne et scénario, résolution par spécificité (scénario > campagne >
défaut) `[Q06]`. Le modèle Prisma (`Persona`, `Campaign.personaId`, `Scenario.personaId`) est
déjà prêt.
**Fichiers** : routes `app/api/personas/*`, UI (admin ou gestion de campagne).
**Décisions à respecter** : `[Q06]`, `[Q24]`.
**Complexité** : M.

### Étape 18 — Profil & avatar
**Dépend de** : rien. **Bloque** : rien.
Porter `maquette/profil.html`. Aujourd'hui `avatarColor` est tiré au hasard dans une liste de 4 à
l'inscription (`apps/web/src/app/api/invite/accept/route.ts`) — donner à l'utilisateur le choix
réel dans une bibliothèque prédéfinie de couleurs, initiales déduites automatiquement du nom
`[Q50]`. Pas d'image personnalisée en V1 (reporté V2, cohérent avec l'absence d'images de contenu
`[Q28]`).
**Fichiers** : nouvelle page profil, route `app/api/profile/*`.
**Décisions à respecter** : `[Q50]`.
**Complexité** : S.

### Étape 19 — Bloc-notes personnel joueur
**Dépend de** : 7 (accessible depuis l'écran de partie). **Bloque** : rien.
Privé, jamais lu par le MJ-IA ni les autres joueurs, sans impact sur le contexte envoyé au modèle
`[Q46]`. Le modèle `PlayerNote` existe déjà (portée campagne). Structure du contenu (libre vs
champs guidés) : `TBD [Q46b]` — implémenter en V1 avec un contenu texte libre simple et documenter
explicitement que c'est une interprétation provisoire de `Q46b`, pas une décision actée.
**Fichiers** : route `app/api/player-notes/*`, UI intégrée à l'écran de partie ou au profil.
**Décisions à respecter** : `[Q46]`, `TBD [Q46b]`.
**Complexité** : S.

### Étape 20 — Bascule Joueur ↔ Spectateur, lecture seule stricte
**Dépend de** : 7. **Bloque** : rien.
Un Utilisateur peut basculer librement entre Utilisateur et Spectateur en cours de partie (fiche
conservée au retour) `[Q08]` ; le Spectateur est en lecture seule stricte, aucune écriture dans le
chat `[Q07]`. Le modèle `PartyParticipant.role` (`JOUEUR`/`SPECTATEUR`) existe déjà — il manque le
contrôle serveur (pas seulement visuel) qui bloque l'écriture socket/API si `role === SPECTATEUR`.
**Fichiers** : `apps/web/src/server/socket.ts` (vérification serveur avant d'accepter
`chat:message`), écran de partie (étape 7).
**Décisions à respecter** : `[Q07]`, `[Q08]`.
**Complexité** : S/M.

### Étape 21 — Sauvegarde `pg_dump` planifiée
**Dépend de** : rien. **Bloque** : rien techniquement, mais c'est une décision actée non tenue —
à ne pas oublier avant tout usage réel avec des données qui comptent.
Ajouter le service/cron de sauvegarde absent de `docker-compose.yml` malgré la décision actée
dans `doc/technique/spec.md`. Un conteneur léger avec `pg_dump` planifié (cron ou service dédié),
écrivant vers un volume/emplacement durable.
**Fichiers** : `docker-compose.yml`, éventuellement un nouveau petit service/Dockerfile de backup.
**Complexité** : S.

### Étape 22 — Durcissement transverse pré-V1
**Dépend de** : traverse toutes les étapes précédentes, à faire en continu plutôt qu'à la fin.
Aucun test automatisé n'existe dans le repo actuellement — a minima des tests sur les points
critiques et déterministes (outils dés/moteur de règles de l'étape 10, résolution de rôles/
permissions, résolution de persona `[Q06]`). Vérification **serveur** systématique des permissions
par rôle sur chaque route API (héritage strict `[Q04]`) — ne jamais s'appuyer sur le fait qu'un
bouton est caché côté UI. Gestion d'erreurs cohérente sur les routes API (déjà un bon patron dans
`api/auth/login/route.ts` et `api/invite/accept/route.ts` à généraliser).
**Fichiers** : transverse.
**Complexité** : M (étalée dans le temps, pas un bloc unique).

---

## 3. Hors périmètre V1 (rappel, ne pas implémenter maintenant)

- Images (bibliothèque ou génération IA) `[Q28]` — V2.
- Avatar personnalisé (image) — V2.
- Génération de nouveaux scénarios à partir d'une inspiration `[Q33]` — V2.
- Génération de cartes `[Q34]` — V3.
- Émotions par la couleur `[Q52]` — V3, piste.
- Ambiance visuelle dynamique par lieu `[Q51]` — probable V2+, démontrée en maquette uniquement
  (`ecran-partie.html`, sélecteur "ambiance" — explicitement pas un vrai contrôle produit).
- Export PDF/journal de l'historique `[Q29]` — reporté, piste V4.
- RGPD/rétention `[Q39]` — pas prioritaire V1, à reprendre avant toute ouverture publique.
- Tout le contenu de la proposition V4 (`doc/roadmap.md`) : suivi de combat/initiative dédié,
  narration audio, PNJ persistants, multi-systèmes, marketplace, intégration VTT, mode asynchrone.

---

## 4. Tableau de suivi

**Premier endroit à regarder pour savoir où reprendre.** Statuts constatés au 2026-08-14 (à tenir
à jour à chaque session).

| # | Étape | Statut | Fichiers principaux concernés |
|---|---|---|---|
| 1 | Authentification réelle du socket | 🚧 en cours (stub avec TODO explicite) | `apps/web/src/server/socket.ts`, `apps/web/src/server/auth.ts` |
| 2 | Émission d'invitation | ❌ à faire (seule l'acceptation existe) | `apps/web/src/app/api/invite/*` |
| 3 | Gestion des campagnes (CRUD) | ❌ à faire | `apps/web/src/app/api/campaigns/*` (à créer) |
| 4 | Scénarios : upload + déclenchement analyse | 🚧 en cours (worker réel, aucun producteur côté web) | `apps/worker/src/workers/ingestion.ts`, `apps/web/src/app/api/scenarios/*` (à créer) |
| 5 | Parties : création/rejoindre/reprendre | ❌ à faire | `apps/web/src/app/api/parties/*` (à créer) |
| 6 | Tableau de bord | ❌ à faire (maquette seule) | `maquette/dashboard.html` → à porter |
| 7 | Écran de partie : chat temps réel | 🚧 en cours (serveur socket prêt, aucun client, pas de persistance) | `apps/web/src/server/socket.ts`, `maquette/ecran-partie.html` → à porter |
| 8 | Boucle de jeu MJ-IA (cœur du gameplay) | ❌ à faire (rien n'existe) | nouveau `apps/web/src/server/gm-turn.ts` |
| 9 | Détection de transition de phase | ❌ à faire | idem étape 8 |
| 10 | Outils dés & moteur de règles complet | 🚧 en cours (`roll_dice` seul existe) | `packages/llm/src/tools/*` |
| 11 | Fiche de personnage (UI) | ❌ à faire (maquette seule) | `maquette/fiche-personnage.html` → à porter |
| 12 | Actions structurées dans le chat | ❌ à faire | écran de partie (étape 7) |
| 13 | Mémoire par entité : vraie extraction LLM | 🚧 en cours (stub, tableau vide codé en dur) | `apps/worker/src/workers/entityMemory.ts` |
| 14 | Résumés hiérarchiques : vraie consolidation LLM | 🚧 en cours (stub, placeholder codé en dur) | `apps/worker/src/workers/summaries.ts` |
| 15 | Notification de fin d'ingestion | ❌ à faire (TODO explicite dans le code) | `apps/worker/src/workers/ingestion.ts` |
| 16 | Administration | ❌ à faire (maquette seule) | `maquette/admin.html` → à porter |
| 17 | Persona MJ (CRUD + résolution) | ❌ à faire | `apps/web/src/app/api/personas/*` (à créer) |
| 18 | Profil & avatar | ❌ à faire (couleur random actuellement) | `maquette/profil.html` → à porter, `apps/web/src/app/api/invite/accept/route.ts` |
| 19 | Bloc-notes personnel joueur | ❌ à faire | `apps/web/src/app/api/player-notes/*` (à créer) |
| 20 | Bascule Joueur ↔ Spectateur, lecture seule | ❌ à faire | `apps/web/src/server/socket.ts` |
| 21 | Sauvegarde `pg_dump` planifiée | ❌ à faire (décidé dans la doc, absent du compose) | `docker-compose.yml` |
| 22 | Durcissement transverse (tests, permissions serveur) | ❌ à faire (aucun test dans le repo) | transverse |
