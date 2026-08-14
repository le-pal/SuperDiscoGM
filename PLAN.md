# Plan de codage — SuperDiscoGM V1

Retour à [doc/index.md](doc/index.md) pour la spec, [doc/roadmap.md](doc/roadmap.md) pour la roadmap, [doc/technique/architecture.md](doc/technique/architecture.md) pour l'architecture.

## Où on en est

La stack tourne bout en bout : Docker Compose (Postgres séparé, migrate one-shot, web, worker, redis, caddy, ollama en dev) est validé, l'auth maison (login/logout/session DB/invitation — acceptation seulement) est validée bout en bout, le schéma Prisma couvre l'intégralité du modèle de données décidé dans `doc/`, `packages/llm` expose une abstraction multi-fournisseurs avec un premier outil déterministe (`roll_dice`) branché dans le job d'ingestion de scénario. Le serveur Socket.IO existe et route déjà les rooms `party:<id>`/`user:<id>` avec la confidentialité du party split appliquée côté serveur.

Ce qui manque pour une V1 jouable, c'est presque tout ce qui touche à l'expérience réelle : aucune page de la maquette n'est portée en React connecté aux vraies données (seules login/invite/accueil existent, en style minimal), le cœur du jeu — le tour de MJ-IA (assemblage de contexte, appel LLM streamé, tool-calls du moteur de règles, mémoire par entité, résumés hiérarchiques) — **n'existe nulle part dans le code actuel**, le socket ne persiste aucun message et fait confiance à un `userId` envoyé librement par le client, et deux des trois workers (`entityMemory.ts`, `summaries.ts`) sont des stubs qui ne font pas de vrai appel LLM.

Ce plan part de cet état réel (vérifié fichier par fichier, pas supposé) et couvre, dans un ordre de dépendances raisonnable, tout ce qu'il reste à construire pour une V1 D&D jouable telle que décrite dans `doc/roadmap.md`. Il applique les décisions déjà actées (`[Qxx]`) sans les rediscuter ; les rares endroits où j'ai dû trancher une modalité d'implémentation non couverte par `doc/` (parce que `TBD [Qxx]` ou parce que la spec ne descend simplement pas à ce niveau de détail) sont marqués **« hypothèse »** explicitement — à confirmer avec Philippe plutôt qu'à considérer comme acté.

Deux fichiers non liés au code traînent à la racine (`claude_github_account_key.pub`, `maquette.zip`) — probablement à nettoyer, mais hors périmètre de ce plan (pas touchés).

---

## Fondations transverses

### Étape 9 — Design system + layout partagé
Porter `maquette/css/style.css` (tokens `--p1..--p4`, `--mj`, `--role-*`, composants `.card`/`.badge`/`.avatar`/`.btn`...) dans `apps/web`, remplacer le `globals.css` par défaut de `create-next-app`. Construire les composants de layout réutilisés par toutes les pages hors `/login` et `/invite/[token]` : topbar avec navigation, badge de rôle, avatar (initiales déduites du nom + couleur — logique pure réutilisée partout, cf. `profil.html` §« Où cet avatar apparaît »).
- Fichiers : `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`, `apps/web/src/components/AppShell.tsx` (nouveau), `apps/web/src/components/TopNav.tsx` (nouveau), `apps/web/src/components/RoleBadge.tsx` (nouveau), `apps/web/src/components/Avatar.tsx` (nouveau).
- Dépendances : aucune.

### Étape 10 — Garde de rôle côté serveur
Helper réutilisable pour protéger les pages/routes par rôle minimum (hiérarchie à héritage strict `[Q04]`), au-dessus de `getCurrentUser()` existant. Complète le garde léger déjà présent dans `proxy.ts` (présence du cookie seulement).
- Fichiers : `apps/web/src/server/authz.ts` (nouveau — `requireUser()`, `requireRole(min: Role)`).
- Dépendances : aucune.

### Étape 11 — Durcir l'auth Socket.IO
`apps/web/src/server/socket.ts` fait actuellement confiance à `socket.handshake.auth.userId` envoyé librement par le client (TODO explicite dans le fichier). Remplacer par une lecture du cookie de session dans les en-têtes du handshake (`socket.handshake.headers.cookie`), puis vérification en DB — même logique que `getCurrentUser()` mais utilisable hors contexte `next/headers`.
- Fichiers : `apps/web/src/server/auth.ts` (extraire une fonction `getUserByToken(token)` réutilisable par `cookies()` et par le handshake socket), `apps/web/src/server/socket.ts`.
- Dépendances : aucune — bloquant avant toute UI temps réel réelle (Étapes 12, 35+).

### Étape 12 — Client Socket.IO
Provider React ouvrant la connexion une fois l'utilisateur authentifié (cookie porté automatiquement, pas de token exposé en JS), hooks `usePartyChannel(partyId)` (join/leave + écoute `chat:message`) et `usePartyPresence(partyId)` (écoute `party:presence`).
- Fichiers : `apps/web/src/lib/socketClient.ts` (nouveau), `apps/web/src/components/SocketProvider.tsx` (nouveau), `apps/web/src/hooks/usePartyChannel.ts`, `apps/web/src/hooks/usePartyPresence.ts` (nouveaux).
- Dépendances : 9, 11.

---

## Admin (`doc/admin/spec.md`)

### Étape 13 — Gestion utilisateurs & rôles
`GET /api/admin/users`, `PATCH /api/admin/users/:id` (changer le rôle système `[Q04]`). Réservé Admin.
- Fichiers : `apps/web/src/app/api/admin/users/route.ts`, `apps/web/src/app/api/admin/users/[id]/route.ts` (nouveaux).
- Dépendances : 10.

### Étape 14 — Envoi d'invitation (manquant : seule l'acceptation existe)
`POST /api/campaigns/:id/invitations` (Super utilisateur) — génère `token`/`expiresAt`/`role`, à afficher comme lien à copier/partager. Le modèle `Invitation` exige un `campaignId` : le formulaire doit donc choisir une campagne cible, pas juste « inviter dans l'app ».
- Fichiers : `apps/web/src/app/api/campaigns/[id]/invitations/route.ts` (nouveau).
- Dépendances : 10, 18 (campagnes doivent exister pour en choisir une).

### Étape 15 — Réglages globaux (Admin)
`GET`/`PATCH /api/admin/settings` — prompt système global `[Q09]`, fournisseur/modèle LLM actif `[Q37]`, budget mensuel.
- Fichiers : `apps/web/src/app/api/admin/settings/route.ts` (nouveau).
- Dépendances : 10.

### Étape 16 — Bibliothèque de personas MJ + résolution par spécificité
CRUD personas (Super utilisateur), et fonction de résolution `scénario > campagne > persona globale par défaut` `[Q06]`, composée par-dessus (jamais à la place de) le prompt système global `[Q24]` — réutilisée telle quelle par l'assemblage de contexte (Étape 30).
- Fichiers : `apps/web/src/app/api/personas/route.ts`, `apps/web/src/app/api/campaigns/[id]/persona/route.ts`, `apps/web/src/app/api/scenarios/[id]/persona/route.ts` (nouveaux), `apps/web/src/server/persona.ts` (nouveau — `resolvePersona(campaignId, scenarioId)`).
- Dépendances : 10.

### Étape 17 — Page `/admin` (portage `admin.html`)
Table utilisateurs + rôles + bouton « inviter », formulaire prompt système, sélection fournisseur/modèle, budget, bibliothèque de personas.
- Fichiers : `apps/web/src/app/admin/page.tsx` (nouveau) + composants.
- Dépendances : 9, 13, 14, 15, 16.

### Étape 50 — Versioning des prompts avec retour arrière (demande explicite de Philippe, `[Q53]`)
Le prompt système global ET les fragments de persona sont versionnés : chaque `PATCH` qui change le contenu journalise la valeur REMPLACÉE (`PromptVersion`, jamais la valeur courante dupliquée). Restaurer = réappliquer le contenu d'une entrée d'historique via le `PATCH` normal, ce qui journalise à son tour la valeur courante (un "redo" reste donc possible).
- Fichiers : `packages/db/prisma/schema.prisma` (modèle `PromptVersion` + enum `PromptTarget`), `apps/web/src/server/promptVersion.ts` (nouveau — `snapshotPromptVersion()`), `apps/web/src/app/api/admin/settings/route.ts` (PATCH modifié), `apps/web/src/app/api/admin/settings/history/route.ts` (nouveau), `apps/web/src/app/api/personas/[id]/route.ts` (nouveau — PATCH manquait jusqu'ici), `apps/web/src/app/api/personas/[id]/history/route.ts` (nouveau).
- Dépendances : 15, 16. La page `/admin` (étape 17) devra exposer l'historique + un bouton "restaurer" une fois portée.

---

## Campagnes & Scénarios (`doc/scenario/spec.md`)

### Étape 18 — API Campagnes
`POST /api/campaigns` (créer, Super utilisateur `[Q05]`), `GET /api/campaigns` (miennes / toutes selon rôle), `GET /api/campaigns/:id`.
- Fichiers : `apps/web/src/app/api/campaigns/route.ts`, `apps/web/src/app/api/campaigns/[id]/route.ts` (nouveaux).
- Dépendances : 10.

### Étape 19 — API Scénarios
`POST /api/scenarios` (texte collé `[Q13]`), `POST /api/scenarios/:id/files` (upload PDF/docx/markdown), `GET /api/scenarios/:id`.
- Fichiers : `apps/web/src/app/api/scenarios/route.ts`, `apps/web/src/app/api/scenarios/[id]/files/route.ts` (nouveaux).
- Dépendances : 10.

### Étape 20 — Extraction de texte des fichiers uploadés
`ScenarioFile.data` est stocké en `Bytes` brut ; il faut en extraire le texte avant analyse (images/cartes ignorées en V1, `[Q13b]`). Ajouter `pdf-parse` (PDF) et `mammoth` (docx) ; markdown/texte lus directement. Le texte extrait alimente `Scenario.rawContent` (ou fusionne si plusieurs fichiers).
- Fichiers : `apps/web/src/server/scenarioFiles.ts` (nouveau — `extractText(file)`), utilisé par l'Étape 19.
- Dépendances : 19.

### Étape 21 — Déclenchement de l'analyse + notification de fin
`POST /api/scenarios/:id/analyze` : passe `status` à `ANALYZING`, enqueue le job `scenario-ingestion` via `packages/jobs` (déjà scaffoldé). Le job worker existe déjà et fait un vrai appel LLM (`apps/worker/src/workers/ingestion.ts`) mais a un TODO explicite (ligne 79) : pas de notification à la fin `[Q14]`. Ajouter un mécanisme pub/sub Redis simple : le worker publie sur un canal à la fin du job, `apps/web` s'y abonne et relaie vers la room `user:<id>` du Super utilisateur via Socket.IO.
- Fichiers : `apps/web/src/app/api/scenarios/[id]/analyze/route.ts` (nouveau), `apps/web/src/server/queue.ts` (nouveau — wrapper `Queue` BullMQ côté web, symétrique du `Worker` côté worker), `apps/web/src/server/notifications.ts` (nouveau — souscription pub/sub → `io.to(userRoom)`), `apps/worker/src/workers/ingestion.ts` (remplacer le TODO par le `publish`).
- Dépendances : 19, 20, 12 (socket pour relayer la notif).

### Étape 22 — Ré-analyse d'un scénario modifié `[Q18]`
`POST /api/scenarios/:id/reanalyze` : relance le pipeline sur un contenu modifié. Une partie déjà en cours doit continuer avec l'ancien découpage jusqu'à sa fin (pas de casse en direct) — donc ne pas supprimer/remplacer les `Phase` référencées par un `Party.currentPhaseId` d'une partie `ACTIVE`/`PAUSED` ; seules les nouvelles parties lancées après la ré-analyse utilisent le nouveau découpage. **Hypothèse** (non détaillée dans `doc/`) : versionner en conservant les anciennes `Phase` orphelines plutôt qu'un modèle de version explicite — suffisant pour l'usage V1 (pas de retour arrière prévu).
- Fichiers : réutilise la logique de l'Étape 21 avec un flag `isReanalysis`.
- Dépendances : 21.

### Étape 23 — Rattachement scénario ↔ campagne
`POST /api/campaigns/:id/scenarios` — table de jonction `CampaignScenario` avec `order` (chapitres enchaînés `[Q10]`).
- Fichiers : `apps/web/src/app/api/campaigns/[id]/scenarios/route.ts` (nouveau).
- Dépendances : 18, 19.

### Étape 24 — Pages d'ingestion (portage `ingestion-scenario.html`)
Formulaire coller-texte / upload fichier, statut d'analyse en direct (socket ou polling léger sur `Scenario.status`), affichage des scènes digérées avec leurs métadonnées (lieu, PNJ, conditions, secrets) une fois `READY`.
- Fichiers : `apps/web/src/app/scenarios/new/page.tsx`, `apps/web/src/app/scenarios/[id]/page.tsx` (nouveaux).
- Dépendances : 9, 19, 20, 21, 22.

---

## Moteur de règles D&D & fiche de personnage (`doc/partie/spec.md` §Fiche de personnage, §Dés & moteur de règles)

### Étape 25 — Création de personnage
**Gap identifié** : ni la spec ni la maquette ne couvrent la création initiale d'une fiche — seule sa mise à jour en jeu par le MJ-IA est spécifiée (`[Q31]`). Sans ça, impossible de jouer. Hypothèse minimale cohérente avec `[Q30]` (fiche simplifiée) et `[Q47]` (une fiche par campagne) : formulaire joueur (nom, race, classe, PV max, caractéristiques de base) à la première participation à une campagne.
- Fichiers : `apps/web/src/app/api/campaigns/[id]/character-sheet/route.ts` (nouveau, `POST` création + `GET` lecture), `apps/web/src/app/campaigns/[id]/character/new/page.tsx` (nouveau).
- Dépendances : 18.

### Étape 26 — Outils déterministes du moteur de règles
Étendre `packages/llm/src/tools/` sur le modèle exact de `rollDiceTool` (schéma zod strict + `execute()` pur côté serveur) : `apply_damage`, `heal`, `add_item`, `remove_item`, `add_condition`, `remove_condition`, `consume_spell_slot`, `update_ac`. Chaque tool écrit dans `CharacterSheet` et trace la modification dans `CharacterSheetLog` (`toolName`/`argsJson`/`resultJson`) — jamais de modification de fiche par texte libre `[Q31b]`/`[Q32b]`.
- Fichiers : `packages/llm/src/tools/characterSheet.ts` (nouveau), `packages/llm/src/tools/index.ts` (enregistrer dans `gameTools`).
- Dépendances : aucune (indépendant de l'UI), consommé par l'Étape 35.

### Étape 27 — API fiche : lecture élargie + actions joueur autonomes
`GET /api/campaigns/:id/character-sheet` (la sienne), `GET /api/campaigns/:id/character-sheets` (vue table pour Super utilisateur/MJ). Actions restées du ressort du joueur `[Q31]` : `POST /api/character-sheets/:id/level-up`.
- Fichiers : `apps/web/src/app/api/campaigns/[id]/character-sheet/route.ts` (complété), `apps/web/src/app/api/character-sheets/[id]/level-up/route.ts` (nouveau).
- Dépendances : 25.

### Étape 28 — Page fiche de personnage (portage `fiche-personnage.html`)
Champs gérés par le MJ-IA en lecture seule, choix joueur (montée de niveau) éditables, journal des modifications (`CharacterSheetLog`) affiché en ordre chronologique inverse pour la traçabilité.
- Fichiers : `apps/web/src/app/campaigns/[id]/character/page.tsx` (nouveau).
- Dépendances : 9, 27.

### Étape 29 — Panneau fiche condensée (sidebar écran de partie)
Portage de la sidebar de `ecran-partie.html` : PV (barre), 2-3 stats clés, inventaire résumé, lien vers la fiche complète (Étape 28).
- Fichiers : `apps/web/src/components/party/CharacterSummaryPanel.tsx` (nouveau).
- Dépendances : 27 ; consommé par l'Étape 41.

---

## Mémoire & contexte du MJ-IA (`doc/scenario/spec.md` §Gestion du contexte) — le plus gros trou fonctionnel actuel

### Étape 30 — Assemblage du contexte de tour
Module central construisant les 5 blocs décrits dans `doc/scenario/spec.md` : scénario digéré (phase active + métadonnées), résumé de partie (`Summary` niveau `SESSION` le plus récent), fiches entités pertinentes (`EntityMemory` filtrées par `Phase.npcTags`/`locationTag` — injection par défaut, `[Q44]` étape 1), prompt système + persona composés (Étape 16), fenêtre glissante des derniers messages. Troncature en cas de dépassement de budget : **dernières conversations tronquées en premier**, tout le reste reste prioritaire `[Q19]`.
- Fichiers : `packages/llm/src/context.ts` (nouveau), `packages/llm/src/tokenBudget.ts` (nouveau — estimation de tokens + logique de troncature).
- Dépendances : 16, 26 (les tools doivent exister pour être déclarés au modèle), le reste (Phase/EntityMemory) est déjà en DB.

### Étape 31 — Outil de récupération à la demande
Deuxième temps du modèle de récupération en deux temps `[Q44]` : tool `lookup_entity_history(entityId)` qui va chercher, via `EntityMemoryIndexEntry`, les `Message` bruts correspondant à un échange passé — appelé par le MJ-IA seulement en cas de doute, jamais injecté par défaut.
- Fichiers : `packages/llm/src/tools/entityLookup.ts` (nouveau).
- Dépendances : 30.

### Étape 32 — Extraction réelle de mémoire par entité (remplace le stub)
`apps/worker/src/workers/entityMemory.ts` a un TODO explicite (`task #7`) et un tableau `detectedEntities` vide en dur (lignes 25-27). Remplacer par un vrai appel `generateObject` qui identifie PNJ/lieux/factions/quêtes `[Q41]` mentionnés dans la plage de messages et met à jour leur fiche résumé courte (`EntityMemory.summary`) + l'index de pointeurs (`EntityMemoryIndexEntry`).
- Fichiers : `apps/worker/src/workers/entityMemory.ts`.
- Dépendances : aucune techniquement, mais garder le schéma de sortie cohérent avec ce que l'Étape 30 attend en lecture.

### Étape 33 — Consolidation réelle des résumés hiérarchiques (remplace le stub)
`apps/worker/src/workers/summaries.ts` a le même TODO (`task #7`) et un `content` placeholder en dur (ligne 21). Remplacer par de vrais appels LLM par niveau : `SESSION` condense les messages de la partie, `ARC` condense les résumés `SESSION` du scénario, `CAMPAIGN` condense les résumés `ARC` de la campagne `[Q22]`.
- Fichiers : `apps/worker/src/workers/summaries.ts`.
- Dépendances : aucune.

### Étape 34 — Détection de transition de phase `[Q17]`
La spec dit « automatique par le MJ-IA, qui compare la conversation en cours aux conditions de sortie de la phase active » sans imposer de mécanisme. Cohérent avec le principe déjà acté ailleurs (aucune règle de jeu improvisée en texte libre), implémenter comme un outil déterministe `advance_phase` que le modèle appelle quand il juge les conditions de sortie remplies — l'outil, pas le texte généré, fait foi et met à jour `Party.currentPhaseId`.
- Fichiers : `packages/llm/src/tools/phase.ts` (nouveau).
- Dépendances : 30.

---

## Écran de partie & temps réel (`doc/partie/spec.md` §Écran de partie)

### Étape 35 — Moteur de tour MJ côté serveur (pièce centrale manquante)
`apps/web/src/server/socket.ts` ne fait aujourd'hui que **relayer** `chat:message` — aucune persistance en DB, aucun appel LLM. Construire `chatEngine.ts` : sur un message `PLAYER`, persister le `Message`, assembler le contexte (Étape 30), appeler `streamText` avec `gameTools` (dés + moteur de règles Étape 26 + lookup Étape 31 + transition de phase Étape 34), streamer la réponse au client via socket, persister le `Message` MJ final, et déclencher (enqueue) `entity-memory-extraction`/`summary-consolidation` après un échange marquant (heuristique simple : tous les N messages ou sur tool-call significatif — pas de queue sur le chemin critique du tour, cohérent avec `doc/technique/architecture.md`).
- Fichiers : `apps/web/src/server/chatEngine.ts` (nouveau), `apps/web/src/server/socket.ts` (brancher l'event `chat:message` sur `chatEngine` au lieu du simple relais).
- Dépendances : 11, 12, 26, 30, 31, 34, 21 (réutilise le wrapper de queue).

### Étape 36 — Party split : repère système + reveal `[Q26]`/`[Q26b]`
Quand le MJ-IA restreint `visibleToUserIds` sur ses messages suivants, insertion automatique d'un `Message` `SYSTEM` visible de tous annonçant l'aparté sans en révéler le contenu. Retour à la normale (`visibleToUserIds` redevient vide) → second `Message` `SYSTEM` de retour ; le reveal du contenu vers la table reste une décision narrative manuelle du MJ-IA (il choisit d'en reparler ou non dans sa narration suivante, pas un mécanisme technique séparé).
- Fichiers : logique intégrée à `apps/web/src/server/chatEngine.ts` (Étape 35).
- Dépendances : 35.

### Étape 37 — Actions structurées joueur `[Q27]`
`/roll NdM` dans le composer déclenche `roll_dice` côté serveur (pas une simulation client), persiste un `DiceRoll` (`requestedByMj: false` — le MJ-IA reste libre de l'ignorer, `[Q32c]`), diffuse le résultat dans le fil. Raccourcis « sélection de sort/objet » = pré-remplissage du texte envoyé, pas un chemin de code séparé.
- Fichiers : `apps/web/src/app/api/parties/[id]/dice/route.ts` (nouveau, ou event socket dédié `dice:roll`), `apps/web/src/components/party/Composer.tsx` (nouveau).
- Dépendances : 35.

### Étape 38 — Historique paginé (scroll infini) `[Q29]`
`GET /api/parties/:id/messages?before=<messageId>&limit=50`, filtrage strict de `visibleToUserIds` côté serveur (jamais renvoyer un message privé à un destinataire non autorisé, même en pagination).
- Fichiers : `apps/web/src/app/api/parties/[id]/messages/route.ts` (nouveau).
- Dépendances : 10.

### Étape 39 — Indicateur de présence câblé côté UI `[Q49]`
Le serveur émet déjà `party:presence` (liste des `userId` connectés par room). Reste à câbler l'affichage — liste nominative (pas juste un compteur, cf. maquette `+1 spectateur`) — sur l'écran de partie et sur le dashboard. **Hypothèse** sur la mécanique précise (`TBD [Q49b]`) : liste nominative simple, pas de notification push distincte à l'arrivée d'un participant en V1 (le changement de présence suffit visuellement).
- Fichiers : consommé via le hook `usePartyPresence` (Étape 12).
- Dépendances : 12.

### Étape 40 — Ambiance dynamique par lieu `[Q51, TBD — traité par hypothèse]`
Le CSS des 3 thèmes (grotte/jungle/ville) existe déjà intégralement dans `maquette/css/style.css` (`.partie-shell[data-ambiance=...]`). Hypothèse minimale pour combler le TBD sans sur-ingénierie : mapping automatique par mots-clés de `Phase.locationTag` vers un des 3 thèmes prédéfinis (repli sur « ville » par défaut), appliqué au changement de phase active (déclenché par l'Étape 34). Pas de génération dynamique de palette en V1 — bibliothèque fixe à 3 thèmes, cohérent avec « probable V2+ » noté dans la spec.
- Fichiers : `apps/web/src/lib/ambiance.ts` (nouveau — `resolveAmbiance(locationTag)`), `apps/web/src/components/party/PartyShell.tsx` (nouveau).
- Dépendances : 34, 12.

### Étape 41 — Page écran de partie (portage complet `ecran-partie.html`)
Topbar avec présence réelle, bandeau de scène active réelle (**sans** les deux contrôles de démo — sélecteur « point de vue » et sélecteur d'ambiance manuel — qui n'existent pas dans le vrai produit, cf. `CLAUDE.md`), fil de chat branché sur 35/38/39, composer (37), sidebar fiche perso condensée (29) + bloc-notes (Étape 46).
- Fichiers : `apps/web/src/app/parties/[id]/page.tsx` (nouveau), `apps/web/src/components/party/ChatScroll.tsx`, `MessageBubble.tsx`, `PresenceBar.tsx`, `SceneStrip.tsx` (nouveaux).
- Dépendances : 9, 35, 36, 37, 38, 39, 40.

---

## Tableau de bord (`doc/partie/spec.md` §Tableau de bord)

### Étape 42 — API Parties
`POST /api/campaigns/:id/parties` (lancer, Super utilisateur `[Q11]`), `POST /api/parties/:id/resume` (recharge l'état exact : phase active, résumé, mémoire — déjà porté nativement par le modèle de données, pas de logique de « reprise » séparée à écrire au-delà de charger l'état courant), `POST /api/parties/:id/join` (rejoindre en `JOUEUR`/`SPECTATEUR`), `POST /api/parties/:id/toggle-role` (bascule libre Utilisateur ↔ Spectateur en cours de partie, fiche conservée `[Q08]`).
- Fichiers : `apps/web/src/app/api/campaigns/[id]/parties/route.ts`, `apps/web/src/app/api/parties/[id]/resume/route.ts`, `apps/web/src/app/api/parties/[id]/join/route.ts`, `apps/web/src/app/api/parties/[id]/toggle-role/route.ts` (nouveaux).
- Dépendances : 18, 23, 10.

### Étape 43 — Agrégation dashboard
Requête(s) serveur (server component direct plutôt qu'API dédiée — plus simple en Next.js) : campagnes créées (Super utilisateur), parties rejointes par l'utilisateur courant `[Q48]`, toutes les parties en cours de l'instance avec présence, en respectant la portée par rôle (un simple Utilisateur ne voit pas les actions de gestion).
- Fichiers : logique intégrée à `apps/web/src/app/page.tsx` (Étape 44).
- Dépendances : 42, 39.

### Étape 44 — Page `/` (remplace la page hello-world actuelle, portage `dashboard.html`)
Cartes campagnes, tableau « parties en cours sur l'instance » avec présence en direct, actions Reprendre/Rejoindre/Détails selon rôle.
- Fichiers : `apps/web/src/app/page.tsx` (remplacer le contenu actuel), `apps/web/src/components/dashboard/CampaignCard.tsx`, `PartyRow.tsx` (nouveaux).
- Dépendances : 9, 42, 43.

---

## Profil & avatar (`doc/partie/spec.md` §Avatar)

### Étape 45 — API + page profil (portage `profil.html`)
`PATCH /api/me/avatar-color` — bibliothèque prédéfinie de couleurs `[Q50]`, initiales déduites automatiquement du nom (fonction pure du composant `Avatar`, Étape 9, réutilisée partout où un avatar est affiché : chat, dashboard, admin).
- Fichiers : `apps/web/src/app/api/me/avatar-color/route.ts` (nouveau), `apps/web/src/app/profile/page.tsx` (nouveau).
- Dépendances : 9, 10.

---

## Bloc-notes joueur (`doc/partie/spec.md` §Écran de partie)

### Étape 46 — Bloc-notes privé `[Q46]`
Le modèle `PlayerNote` impose déjà `@@unique([userId, campaignId])` — une entrée par joueur et par campagne. **Hypothèse** pour combler `TBD [Q46b]` (structure/portée fine) : contenu texte libre (pas de champs guidés), portée campagne telle que le schéma la fixe déjà — pas de sur-ingénierie sur un point non tranché. Jamais lu par le MJ-IA ni par le contexte envoyé au modèle (à vérifier explicitement : l'Étape 30 ne doit **jamais** lire `PlayerNote`).
- Fichiers : `apps/web/src/app/api/campaigns/[id]/notes/route.ts` (nouveau), `apps/web/src/components/party/PlayerNotesTab.tsx` (nouveau, onglet « Bloc-notes 🔒 » de la sidebar).
- Dépendances : 41, 10.

---

## Tests

### Étape 47 — Mettre en place une stratégie de test raisonnable
Aucun test n'existe dans le repo actuellement (vérifié — seuls des tests de `node_modules` remontent sur une recherche large). Éviter le sur-ingineering pour un usage perso/petit groupe (`[Q40]`) : pas de suite E2E lourde en V1.
- **Vitest** en workspace racine pour les unités à fort risque de régression silencieuse : `packages/llm/src/tools/*.ts` (dés + moteur de règles — leur raison d'être est le déterminisme, à tester dès qu'écrits), `packages/llm/src/context.ts` (ordre des blocs et troncature `[Q19]`), `apps/web/src/lib/ambiance.ts`.
- **Tests d'intégration ciblés**, pas de couverture large, sur ce qui casserait silencieusement et grave si buggé : confidentialité des messages privés (party split — l'Étape 38 ne doit jamais fuiter un message hors des destinataires autorisés), contrôle de rôle (un Spectateur ne peut pas écrire, un Utilisateur ne peut pas créer de campagne), rejet de connexion socket sans cookie de session valide (Étape 11).
- Pas de tests UI automatisés en V1 — vérification manuelle via le navigateur suffit à cette échelle.
- Fichiers : `package.json` racine (ajouter un script `test`), `vitest.config.ts` (nouveau), fichiers `*.test.ts` colocalisés avec le code testé.
- Dépendances : à écrire au fil de chaque étape correspondante plutôt qu'en bloc final — listé ici pour la mise en place initiale de l'outillage (26, 30 en priorité).

---

## Divers / infra

### Étape 48 — Suivi de budget/coût API
**Gap identifié, aucune décision actée dans `doc/`** : la spec dit « budget/clé API globale gérée par l'Admin » `[Q03]` et la maquette affiche « 42 € / 150 € », mais rien dans le schéma ne capture la consommation réelle. Hypothèse minimale : un modèle `UsageLog` (provider, modèle, tokens in/out, coût estimé, date), alimenté à chaque appel LLM (Étape 35 pour le chemin synchrone, workers d'ingestion/mémoire/résumés pour l'asynchrone), agrégé pour l'affichage du panneau Admin (Étape 17).
- Fichiers : `packages/db/prisma/schema.prisma` (nouveau modèle `UsageLog` + migration), `apps/web/src/server/usage.ts` (nouveau — `logUsage()`, `getMonthlySpend()`).
- Dépendances : 35, 17.

### Étape 49 — Sauvegarde `pg_dump` planifiée
`doc/technique/spec.md` la mentionne explicitement comme actée « dès la V1 », mais `docker-compose.yml` actuel n'a aucun service de backup. Ajouter un mécanisme simple (conteneur avec `pg_dump` en cron + volume de sortie) — pas de solution externe complexe, cohérent avec l'hébergement perso/petit groupe `[Q40]`.
- Fichiers : `docker-compose.yml`, `scripts/backup.sh` (nouveau).
- Dépendances : aucune — indépendant, peut être fait à tout moment.

---

## Tableau de suivi

| # | Étape | Domaine | Statut | Dépendances |
|---|---|---|---|---|
| 1 | Auth maison (login/logout/session DB/invitation — acceptation) | Fondations (existant) | ✅ fait | — |
| 2 | Socket.IO — serveur scaffold (rooms party/user, relais chat:message, présence) | Fondations (existant) | ✅ fait | — |
| 3 | `packages/db` — schéma Prisma + migrations | Fondations (existant) | ✅ fait | — |
| 4 | `packages/jobs` — contrats de queue partagés | Fondations (existant) | ✅ fait | — |
| 5 | `packages/llm` — abstraction multi-fournisseurs + outil `roll_dice` | Fondations (existant) | ✅ fait | — |
| 6 | `apps/worker` — job `ingestion.ts` (découpage en scènes, appel LLM réel) | Scénario (existant) | ✅ fait (notification de fin manquante, cf. #21) | — |
| 7 | Docker Compose (postgres/migrate/web/worker/redis/caddy/ollama dev) | Infra (existant) | ✅ fait | — |
| 8 | Pages minimales (login, invite/accept, accueil hello-world) | UI (existant) | ✅ fait (à remplacer par le vrai portage) | — |
| 9 | Design system + layout partagé (AppShell/TopNav/Avatar) | Fondations | ✅ fait | — |
| 10 | Garde de rôle côté serveur (requireUser/requireRole) | Fondations | ✅ fait | — |
| 11 | Durcir l'auth Socket.IO (cookie de session, pas de userId client) | Fondations | ✅ fait | — |
| 12 | Client Socket.IO (provider + hooks join/leave/presence) | Fondations | ✅ fait | 9, 11 |
| 13 | Gestion utilisateurs & rôles (API Admin) | Admin | ✅ fait | 10 |
| 14 | Envoi d'invitation (API, Super utilisateur) | Admin | ✅ fait | 10, 18 |
| 15 | Réglages globaux (prompt système, modèle, budget — API Admin) | Admin | ✅ fait | 10 |
| 16 | Bibliothèque de personas MJ + résolution par spécificité | Admin | ✅ fait | 10 |
| 17 | Page `/admin` (portage) | Admin | ❌ à faire | 9, 13, 14, 15, 16 |
| 18 | API Campagnes (create/list/get) | Scénario | ✅ fait | 10 |
| 19 | API Scénarios (create texte + upload fichier) | Scénario | ✅ fait (extraction texte = etape 20, separee) | 10 |
| 20 | Extraction de texte des fichiers uploadés (pdf/docx/md) | Scénario | ✅ fait | 19 |
| 21 | Déclenchement de l'analyse + notification de fin | Scénario | ✅ fait | 19, 20, 12 |
| 22 | Ré-analyse d'un scénario modifié | Scénario | ✅ fait | 21 |
| 23 | Rattachement scénario ↔ campagne (ordre des chapitres) | Scénario | ✅ fait | 18, 19 |
| 24 | Pages d'ingestion (portage `ingestion-scenario.html`) | Scénario | ❌ à faire | 9, 19, 20, 21, 22 |
| 25 | Création de personnage (gap comblé par hypothèse) | Fiche perso | ❌ à faire | 18 |
| 26 | Outils déterministes du moteur de règles (dégâts, objets, conditions, sorts, CA) | Fiche perso | ❌ à faire | — |
| 27 | API fiche : lecture élargie + actions joueur (montée de niveau) | Fiche perso | ❌ à faire | 25 |
| 28 | Page fiche de personnage (portage) | Fiche perso | ❌ à faire | 9, 27 |
| 29 | Panneau fiche condensée (sidebar écran de partie) | Fiche perso | ❌ à faire | 27 |
| 30 | Assemblage du contexte de tour (5 blocs, troncature Q19) | Mémoire & contexte | ❌ à faire | 16, 26 |
| 31 | Outil de récupération à la demande (lookup_entity_history) | Mémoire & contexte | ❌ à faire | 30 |
| 32 | Extraction réelle de mémoire par entité (remplace le stub) | Mémoire & contexte | ✅ fait (pas encore testé contre un LLM qui tourne) | — |
| 33 | Consolidation réelle des résumés hiérarchiques (remplace le stub) | Mémoire & contexte | ✅ fait (pas encore testé contre un LLM qui tourne) | — |
| 34 | Détection de transition de phase (outil `advance_phase`) | Mémoire & contexte | ❌ à faire | 30 |
| 35 | Moteur de tour MJ côté serveur (persistance + génération streamée) | Écran de partie | ❌ à faire | 11, 12, 26, 30, 31, 34, 21 |
| 36 | Party split — repère système + reveal | Écran de partie | ❌ à faire | 35 |
| 37 | Actions structurées joueur (`/roll`, raccourcis) | Écran de partie | ❌ à faire | 35 |
| 38 | Historique paginé (scroll infini) | Écran de partie | ❌ à faire | 10 |
| 39 | Indicateur de présence câblé côté UI | Écran de partie | ❌ à faire | 12 |
| 40 | Ambiance dynamique par lieu (hypothèse) | Écran de partie | ❌ à faire | 34, 12 |
| 41 | Page écran de partie (portage complet) | Écran de partie | ❌ à faire | 9, 35, 36, 37, 38, 39, 40 |
| 42 | API Parties (lancer/reprendre/rejoindre/bascule rôle) | Dashboard | ❌ à faire | 18, 23, 10 |
| 43 | Agrégation dashboard | Dashboard | ❌ à faire | 42, 39 |
| 44 | Page `/` (portage `dashboard.html`) | Dashboard | ❌ à faire | 9, 42, 43 |
| 45 | API + page profil (couleur avatar) | Profil | ❌ à faire | 9, 10 |
| 46 | Bloc-notes privé (API + onglet sidebar) | Bloc-notes | ❌ à faire | 41, 10 |
| 47 | Mise en place Vitest + tests unitaires/intégration ciblés | Tests | ❌ à faire | 26, 30 |
| 48 | Suivi de budget/coût API (UsageLog) | Infra | ❌ à faire | 35, 17 |
| 49 | Sauvegarde `pg_dump` planifiée | Infra | ❌ à faire | — |
| 50 | Versioning des prompts avec retour arrière (Q53, demande explicite) | Admin | ✅ fait | 15, 16 |
