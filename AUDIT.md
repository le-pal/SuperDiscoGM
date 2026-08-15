# Audit — SuperDiscoGM

Audit du code et de l'architecture produits pendant la session du 2026-08-14/15 (50 étapes de `PLAN.md`, environnement de test réel monté cette nuit). Lecture/analyse uniquement — aucun correctif appliqué ici. Sceptique par construction : l'objectif n'est pas de confirmer les notes de commit déjà écrites, mais de trouver ce qui n'a pas été vu en écrivant ce code.

## Résumé exécutif

1. **Faille d'accès critique : n'importe quel utilisateur authentifié peut rejoindre n'importe quelle partie** (`POST /api/parties/[id]/join`, aucune vérification d'invitation) et **lire les secrets de n'importe quel scénario** (`GET /api/scenarios/[id]` renvoie `Phase.secrets` sans aucun contrôle d'accès). Ces deux routes cassent le modèle multi-tenant [Q02] et le principe même du secret de MJ [Q16].
2. **Aucun verrou de concurrence sur le moteur de tour** : deux messages envoyés à quelques centaines de ms d'écart dans la même partie déclenchent deux `runMjTurn` en parallèle, avec un vrai risque de double application de tool-calls (dégâts en double, deux transitions de phase) et de flux de streaming entrelacés côté client.
3. **Deux bugs de troncature silencieuse de la même famille** ont déjà été trouvés et corrigés cette nuit (`num_ctx` Ollama) ; un troisième dort encore dans le code : `stopWhen: stepCountIs(5)` dans `turnEngine.ts` arrête la boucle d'outils du MJ-IA après 5 étapes sans aucun signal utilisateur si le tour en avait besoin de plus.
4. **Aucune règle `onDelete` dans `schema.prisma`** — non exploitable aujourd'hui (aucune route DELETE n'existe), mais une bombe à retardement pour la V2 dès qu'une suppression sera ajoutée.
5. Le reste est globalement solide : la discipline de validation (tsc/build à chaque étape), le pattern tool-calling déterministe, la séparation session.ts/auth.ts, le party split — tout ça tient la route et n'a pas besoin d'être retouché en urgence.

## Constats détaillés

### Sécurité / autorisation

**[CRITIQUE] `POST /api/parties/[id]/join` — aucune vérification d'invitation**
`apps/web/src/app/api/parties/[id]/join/route.ts:7-24`. La route ne vérifie que `requireUser()` (n'importe quel compte authentifié) puis fait un `upsert` sur `PartyParticipant` sans jamais consulter la table `Invitation`. Concrètement : un Utilisateur invité sur UNE campagne peut, en devinant ou en énumérant des `partyId` (cuid, difficiles à deviner mais pas infaisable, et visibles dans l'URL `/party/[id]` s'ils fuient par un lien partagé), rejoindre n'importe quelle autre partie de l'instance en JOUEUR — accès au chat complet, à la création de fiche de personnage, au bloc-notes de campagne. Ça vide de son sens tout le système d'invitation par lien [Q38] : l'invitation contrôle qui peut *créer un compte*, mais plus rien ne contrôle qui peut *rejoindre une table* une fois authentifié.
Impact réel : sur une instance multi-tenant [Q02] avec plusieurs Super utilisateurs indépendants (le cas d'usage explicitement visé), n'importe quel joueur d'une table peut s'inviter lui-même sur la table de quelqu'un d'autre.

**[CRITIQUE] `GET /api/scenarios/[id]` — fuite des secrets de MJ à tout utilisateur authentifié**
`apps/web/src/app/api/scenarios/[id]/route.ts:9-15`. `requireUser()` seul, puis `include: { phases: {...} }` sans `select` — renvoie `Phase.secrets` et `Scenario.rawContent` en clair. Aucune vérification que l'appelant participe à une campagne utilisant ce scénario. Le champ `secrets` existe précisément pour ne "pas révéler d'emblée" [Q16] côté MJ-IA — cette route le sert intégralement en JSON à quiconque a un compte et connaît/devine l'ID.
Impact réel : un joueur curieux (ou n'importe quel compte SPECTATOR créé pour une autre table) peut lire à l'avance tous les rebondissements et secrets de n'importe quel scénario de l'instance.

**[MAJEUR] `POST /api/parties/[id]/resume` — aucune vérification de participation**
`apps/web/src/app/api/parties/[id]/resume/route.ts:8-9`. `await requireUser()` sans capturer la valeur retournée, aucun contrôle de rôle ni de participation. Renvoie l'état complet de la partie (campagne, scénario, résumé de session le plus récent, participants) à quiconque. Moins grave que les deux ci-dessus (pas de fuite de secrets bruts, pas de gain d'accès JOUEUR), mais même famille de problème : la fonction "lecture d'état de partie" n'a jamais de garde de membership dans ce fichier.

**[MAJEUR] `GET /api/campaigns/[id]` — lecture ouverte assumée, mais pas documentée comme un choix produit**
`apps/web/src/app/api/campaigns/[id]/route.ts:5-8`. Le commentaire dit explicitement "pas de restriction de rôle ici" — c'est un choix conscient, mais combiné aux deux failles ci-dessus (join sans invitation + secrets de scénario ouverts), l'effet cumulé est qu'un compte quelconque peut : lister ce qu'une campagne contient (`GET`), rejoindre sa/ses parties (`join`, sans invitation), lire les secrets de son scénario (`GET scenario`). Les trois bugs se combinent en un chemin d'attaque complet, alors que chacun pris isolément semblait mineur.

**[MINEUR] Cohérence globale du reste des routes** — le sweep systématique des 32 routes API montre un pattern `requireUser()`/`checkRole()` appliqué de façon cohérente PARTOUT AILLEURS (campagnes, scénarios en écriture, personas, admin, messages de partie qui font bien le contrôle participant-ou-Super-utilisateur). Les 3 trous ci-dessus sont des exceptions isolées, pas un problème systémique — bonne nouvelle pour l'effort de correction (patch localisé, pas une réécriture).

### Concurrence / moteur de tour

**[MAJEUR] Aucun verrou par partie sur `runMjTurn`**
`apps/web/src/server/turnEngine.ts` + `apps/web/src/server/socket.ts`. Chaque `chat:message` reçu déclenche `runMjTurn(io, partyId, ...).catch(...)` en fire-and-forget, sans jamais vérifier qu'un tour est déjà en cours pour cette `partyId`. Si deux joueurs de la même table envoient un message à quelques centaines de millisecondes d'intervalle (cas réaliste dès qu'il y a plus d'un joueur actif), deux exécutions de `runMjTurn` tournent en parallèle sur le même contexte :
- Les deux lisent `assembleTurnContext` avant que l'autre n'ait persisté sa réponse → contexte légèrement obsolète pour l'un des deux.
- Les deux streament sur `chat:stream` vers la même room en même temps → texte entrelacé côté client (bug visuel direct, testable).
- Si le MJ-IA décide dans les deux tours d'appliquer un tool-call (ex: dégâts, avancée de phase), rien n'empêche une double application — dégâts comptés deux fois, deux annonces de transition de phase.
Ce n'est pas un cas limite exotique : c'est le mode d'usage normal du produit (table de 2 à 5 joueurs qui parlent en même temps, cf maquette). Correctif raisonnable : une file d'attente par `partyId` (mutex applicatif en mémoire, ou passer par une queue BullMQ dédiée par partie) plutôt que le déclenchement direct actuel.

**[MAJEUR] `stopWhen: stepCountIs(5)` — troncature silencieuse potentielle, même famille que le bug `num_ctx` déjà trouvé**
`apps/web/src/server/turnEngine.ts:183`. La boucle d'outils du MJ-IA s'arrête après 5 étapes (appel modèle + tool-calls), sans qu'aucun signal ne prévienne le joueur si le tour avait besoin de continuer (ex: un tour avec plusieurs jets de dés + plusieurs modifications de fiche + une transition de phase peut dépasser 5 étapes). Le symptôme serait le même que le bug `num_ctx` trouvé cette nuit : une réponse MJ qui s'arrête au milieu d'une séquence d'actions sans qu'on sache pourquoi. Pas encore observé en conditions réelles (les simulations testées cette nuit n'ont probablement pas déclenché 5+ tool-calls dans un seul tour), mais c'est exactement le genre de plafond arbitraire qui a déjà mordu une fois — vaut la peine d'être testé avec un tour délibérément chargé en actions.

**[MINEUR] Incohérence de gestion d'erreur entre `recordUsage` et les queues BullMQ**
`turnEngine.ts:213` capture explicitement l'échec de `recordUsage` avec un `.catch()` dédié et un message de log ciblé ; les deux `queue.add(...)` juste en dessous (lignes 237-247) n'ont pas ce traitement — ils remontent l'exception à l'appelant, qui la catch de façon générique dans `socket.ts` (`console.error` non spécifique). Ça fonctionne (dégradation propre confirmée par les tests de cette nuit), mais le style est incohérent : soit tout est catché localement avec un message clair, soit rien ne l'est.

### Modèle de données

**[MAJEUR pour la V2, non exploitable en V1] Aucune règle `onDelete` dans `schema.prisma`**
Vérifié sur les 20+ relations du schéma : aucune ne déclare `onDelete`. Par défaut Prisma/Postgres, c'est `NO ACTION` — toute tentative de suppression d'une ligne référencée ailleurs échoue avec une violation de contrainte FK. Aujourd'hui ce n'est **pas un bug actif** : un grep sur `export async function DELETE` dans `apps/web/src/app/api` ne retourne aucun résultat, aucune route ne supprime quoi que ce soit (à l'exception d'un `phase.deleteMany` ciblé et prudent dans `apps/worker/src/workers/ingestion.ts`, qui filtre explicitement les phases encore référencées). Mais le jour où quelqu'un ajoute "Supprimer une campagne" ou "Supprimer un utilisateur" côté Admin, deux issues possibles et aucune n'est bonne par défaut : soit ça échoue systématiquement sur la première FK rencontrée (mauvaise UX), soit quelqu'un ajoute `onDelete: Cascade` sans réfléchir au graphe complet et une suppression de `Campaign` finit par emporter `CharacterSheet`, `EntityMemory`, `Message`, `Summary` — probablement pas ce qu'on veut pour un historique de partie. À trancher explicitement modèle par modèle avant d'exposer la moindre fonctionnalité de suppression.

**[MINEUR] `EntityMemoryIndexEntry.fromMessageId`/`toMessageId` sont des `String` nus, pas des relations Prisma**
`schema.prisma:382-383`. Contrairement à tout le reste du schéma, ces deux champs pointent vers des `Message.id` sans `@relation` — aucune contrainte FK, aucune intégrité référentielle. Aujourd'hui rien ne supprime de `Message`, donc pas de pointeur mort en pratique, mais c'est une incohérence de modélisation (le reste du schéma est rigoureux sur les FK) qui deviendrait un vrai problème si un nettoyage d'historique de partie est ajouté un jour — les entrées d'index resteraient orphelines silencieusement, sans qu'aucune contrainte ne le signale.

**[MINEUR] Champs `Json` sans validation de schéma persistante**
`CharacterSheet.stats/inventory/conditions/spellSlots`, `CharacterSheetLog.argsJson/resultJson`, `DiceRoll.result`. Validés par zod uniquement au moment de l'écriture initiale (les tools `ai`), jamais revalidés à la lecture. Les 4 casts `as any` trouvés dans le code (`socket.ts:137`, `characterSheet.ts:24,59,70`) sont bien ciblés et commentés (contrainte `InputJsonValue` de Prisma) — ce n'est pas de la dette qui s'accumule de façon anarchique, juste une conséquence assumée du choix Json. Le vrai risque est ailleurs : si un futur outil MJ-IA écrit une forme légèrement différente dans `inventory` (ex: un champ renommé), rien en base ne le détecterait avant que le code de lecture (`toCharacterSheetView` dans `lib/characterSheet.ts`) ne plante ou ne silencieusement mal-interprète les données.

### Qualité de code

**[MINEUR] Duplication du pattern `requireUser`/`checkRole` + requête Prisma**
Les 32 routes API répètent quasi-systématiquement la même forme (`const user = await checkRole("X"); if (!user) return 403; const { id } = await params; const record = await prisma.xxx.findUnique(...); if (!record) return 404; ...`). Fonctionnel et lisible, mais un petit helper (`withAuth(minRole, handler)` ou équivalent) réduirait la surface où un oubli de contrôle (comme les 3 trouvés ci-dessus) peut se glisser. Ce n'est pas neutre : les 3 failles de sécurité trouvées dans cet audit sont TOUTES des oublis de la même ligne de garde que 29 autres routes ont bien — un point de centralisation les aurait rendues structurellement impossibles plutôt que dépendantes de la vigilance de chaque route.

**[MINEUR] Hypothèses documentées comme gap de spec — recensement**
Grep sur "hypothèse"/"gap"/"TBD"/"reporté" dans les messages de commit et commentaires de code fait remonter, en plus de celles déjà bien documentées (création de personnage étape 25, ambiance par mots-clés étape 40) :
- Le party split ne peut être initié QUE par un joueur qui envoie lui-même un message privé (`socket.ts`) — le MJ-IA n'a aucun tool pour isoler un joueur de sa propre initiative narrative, alors que la spec [Q26] décrit explicitement "le MJ-IA peut isoler un ou deux personnages" comme une action du MJ. C'est le gap le plus visible entre la spec et le comportement réel — documenté honnêtement dans le commit de l'étape 36, mais jamais rouvert depuis. Si la mécanique de party split est un axe important du produit (elle est mise en avant dans la maquette et le pitch), c'est probablement la fonctionnalité la plus incomplète du lot malgré son statut "✅ fait" dans PLAN.md.
- Q46b (structure fine du bloc-notes) reste `TBD` mais le champ `PlayerNote.content` est un simple `String` libre — la portée "campagne, pas scénario" a été tranchée par le modèle de données sans jamais rouvrir formellement Q46b dans la doc (juste une déduction depuis le schéma).

### Tests

**[MAJEUR] Zéro test d'intégration avant cette nuit ; toujours zéro test automatisé pour les 3 failles de sécurité trouvées ci-dessus**
29 tests unitaires (`characterSheetLogic`, `dice`) couvrent la logique pure du moteur de règles — solide, mais c'est la portion la plus facile à tester du système. `turnContext.ts`, `turnEngine.ts`, et surtout la couche autorisation des routes API n'ont aucun test automatisé, alors que c'est précisément là que les 3 failles critiques/majeures de cet audit vivent. Maintenant qu'un environnement de test réel existe (Postgres + Redis + Ollama embarqués, confirmé opérationnel cette nuit), le test le plus rentable à écrire n'est pas plus de couverture sur le moteur de règles (déjà bien couvert) mais un test d'intégration systématique du type "pour chaque route, un utilisateur sans lien avec la ressource reçoit 403/404" — aurait attrapé les 3 failles ci-dessus directement.

### Infra / déploiement

**[MINEUR, non vérifiable cette session] `docker-compose.yml` et le service `backup` (étape 49) jamais exécutés en conditions réelles**
Docker Desktop est resté injoignable la quasi-totalité de la session — la config a été validée syntaxiquement (`docker compose config`) mais jamais démarrée pour de vrai. Le service `backup` (pg_dump quotidien, rétention 14j) n'a donc jamais tourné un seul cycle réel. Risque faible (c'est un service isolé, pas de dépendance croisée compliquée) mais à vérifier en premier dès que Docker est de nouveau disponible, avant de s'y fier pour une vraie sauvegarde.

## Plan d'amélioration priorisé

### Phase 1 — avant toute mise en production, même à un seul groupe
1. **Corriger les 3 failles d'autorisation** (join sans invitation, secrets de scénario ouverts, resume sans membership) — effort : petit (quelques heures), c'est le patch le plus rentable de tout cet audit.
2. **Sérialiser `runMjTurn` par `partyId`** (mutex en mémoire suffit à cette échelle, pas besoin de passer par une queue distribuée) — effort : petit à moyen, mais délicat à bien tester sans un vrai test de charge concurrentiel.
3. **Tester `stopWhen: stepCountIs(5)` avec un tour délibérément chargé** (plusieurs jets + plusieurs tool-calls fiche + transition de phase dans le même tour) pour confirmer ou infirmer le risque — effort : quasi nul avec l'environnement de test déjà en place, juste un scénario de simulation à écrire.
4. **Écrire les tests d'intégration "accès refusé"** pour les 32 routes API (au moins les mutations et les lectures de données sensibles) — effort : moyen, mais l'environnement existe déjà.

### Phase 2 — avant d'ouvrir à plus d'un groupe/table simultanément (multi-tenant réel)
5. **Décider et documenter les règles `onDelete`** modèle par modèle avant d'exposer la moindre fonctionnalité de suppression — effort : petit (réflexion) + petit (migration).
6. **Centraliser le pattern d'autorisation des routes** (helper `withAuth`) pour rendre structurellement plus difficile un futur oubli comme les 3 failles trouvées — effort : moyen (refactor mécanique mais touche 32 fichiers).
7. **Rouvrir le gap party split initié par le MJ** si c'est un axe produit important — effort : moyen (nouveau tool + décision produit sur le déclencheur).
8. **Faire tourner `docker-compose.yml` en vrai** (build + boot complet, y compris le service `backup`) dès que Docker est disponible — effort : petit, mais bloqué par l'environnement.

### Phase 3 — nice-to-have
9. Relation Prisma propre pour `EntityMemoryIndexEntry.fromMessageId/toMessageId`.
10. Harmoniser la gestion d'erreur queue BullMQ vs `recordUsage` (cohérence de style).
11. Un vrai compteur de tokens (au lieu de l'estimation par caractères) pour `assembleTurnContext`, une fois qu'on a un budget pour l'intégrer proprement par fournisseur.

## Ce qui est solide et n'a pas besoin d'y toucher

- Le pattern tool-calling déterministe (dés, fiche de personnage, transition de phase) est appliqué avec constance sur tout le moteur de jeu — aucune improvisation en texte libre trouvée en le cherchant activement.
- La séparation `session.ts`/`auth.ts` (fix du bug AsyncLocalStorage) est propre et le commentaire explique bien le piège évité.
- Le filtrage de confidentialité du party split (`visibleToUserIds`, jamais un filtrage client) est appliqué correctement partout où des messages transitent, y compris dans le nouveau `GET /api/parties/[id]/messages` paginé.
- La discipline de commit (validation tsc/build systématique, messages qui expliquent le "pourquoi", `[Qxx]` tracés jusqu'à la doc) a produit un historique git exceptionnellement lisible pour auditer — ça a directement rendu cet audit plus rapide et plus fiable à faire.
- Les 3 migrations générées cette nuit contre le Postgres embarqué (rattrapage complet du schéma) sont cohérentes et le dépôt n'a aucune dérive schéma/code à ce jour.

## Audit IHM (navigateur, session du 2026-08-15)

Test en conditions réelles demandé par Philippe — ouvrir l'app dans un vrai navigateur plutôt que de lire le code React. Environnement : serveur de dev déjà lancé (`apps/web`, custom server via tsx/Turbopack, port 3000) contre le Postgres/Redis/Ollama embarqués de test. **Portée réduite par rapport au plan initial** : un bug bloquant sur `/login` a empêché d'aller plus loin dans le parcours prévu (dashboard, ingestion, admin, fiche de personnage, écran de partie, profil restent NON testés en navigateur cette session). Ré-ingestion Ollama de confirmation (partie 1 de la demande) reportée pour la même raison de temps — déjà validée en profondeur plus tôt cette session (voir plus haut dans ce document/commits `f708d54`/`48eaf7e`), pas de raison de suspecter une régression mais non re-confirmée aujourd'hui.

**Facteur confondant à connaître avant de lire ce qui suit** : au moment du test, deux autres agents modifiaient activement des fichiers UI en direct (thèmes visuels, remontée d'erreurs front) sur ce même dépôt, avec le serveur de dev qui recompile à chaud sur chaque modification. Le serveur est devenu par moments franchement instable (pages qui ne répondent plus, scripts qui timeout) — une partie de ce qui suit est peut-être de l'instabilité de dev-server sous charge de recompilation plutôt qu'un bug produit pur. Le point le plus important ci-dessous (les 503 sur des chunks précis) s'est cependant reproduit à l'identique sur plusieurs tentatives, ce qui plaide pour un vrai bug plutôt que du bruit aléatoire.

### `/login` — [BLOQUANT] Page non stylée ET non interactive

**Ce qui aurait dû se passer** : page de connexion aux couleurs de l'app (cf `maquette/login.html`), formulaire qui authentifie via `POST /api/auth/login` et redirige vers `/`.

**Ce qui s'est passé** :
1. **Zéro style appliqué** — page en HTML par défaut du navigateur (liens soulignés bleus, inputs avec simple soulignement, bouton gris système). Cause confirmée en lisant `apps/web/src/app/login/page.tsx` : le fichier contient littéralement le commentaire `// Version fonctionnelle minimale — portage visuel complet de maquette/login.html à faire séparément.` — **le portage visuel de `/login` n'a en réalité jamais été fait**, malgré l'étape 8 de `PLAN.md` marquée ✅ dès le tout début de la session (avec la même réserve déjà notée à l'époque, mais jamais reprise dans aucune des 50 étapes suivantes — aucune étape du plan ne couvre explicitement "porter `/login`"). C'est un vrai trou dans le plan, pas juste un oubli de dernière minute.
2. **Formulaire non interactif au premier chargement** — cliquer sur "Se connecter" ne déclenche RIEN (pas de requête réseau vers `/api/auth/login`, confirmé via l'outil de lecture réseau). Vérification directe : `document.querySelector('button[type=submit]')` n'a AUCUNE propriété `__reactProps*`/`__reactFiber*` — React n'a jamais hydraté cette page. En inspectant le réseau, deux chunks precis échouent en **503** de façon reproductible sur plusieurs rechargements : `chunks/0s-bs0hlbcn8y.css` (la feuille de style globale — explique le point 1) et `chunks/turbopack-*.js` (le runtime Turbopack lui-même — explique l'absence totale d'hydratation, donc de tout JS interactif sur la page). Le premier essai (avant d'isoler le problème) a par ailleurs produit une vraie soumission de formulaire native (rechargement de page, `?` ajouté à l'URL) — cohérent avec l'absence de handler React pour intercepter le submit.
3. **Confirmé indépendamment que le backend fonctionne** : un appel direct `fetch('/api/auth/login', ...)` depuis la console du navigateur avec les mêmes identifiants renvoie `200 {"ok":true}` sans problème. Le bug est entièrement côté chargement des assets front, pas dans la logique d'auth elle-même.

**Sévérité** : bloquant au sens strict — si ce 503 n'est pas un artefact de charge de dev-server (voir facteur confondant plus haut), c'est la porte d'entrée de toute l'application qui est cassée pour un utilisateur réel. Même si c'était un artefact ponctuel : **l'absence totale de filet de rattrapage si l'hydratation échoue** (pas de fallback `<noscript>`, pas de détection "le JS n'a pas chargé, réessaie", pas même une erreur visible) est un vrai problème de robustesse en soi, indépendamment de la cause exacte du 503 observé ici.

**À vérifier en priorité, hors de tout contexte de charge concurrente** (rejouer ce test seul, dev-server fraîchement démarré, aucun autre agent n'éditant de fichiers en même temps) pour confirmer si c'est un vrai bug produit ou un artefact de cette nuit précise.

### Top des points à retenir si Philippe ne garde que 3 choses de cette section

1. **`/login` n'a jamais été visuellement porté** — trou de `PLAN.md` jamais rattrapé en 50 étapes, à corriger indépendamment du bug de chargement des chunks.
2. **Aucun garde-fou si l'hydratation React échoue** sur une page critique (login) — un utilisateur réel n'aurait aucun indice de ce qui ne va pas, juste un formulaire qui ne fait rien.
3. **Reproduire ce test dans un environnement calme** (sans recompilation concurrente déclenchée par d'autres agents) avant de conclure si les 503 sur les chunks `turbopack-*`/CSS sont un vrai bug du serveur custom (`apps/web/server.ts`) ou juste de la charge — si c'est un vrai bug, il touche potentiellement TOUTES les pages, pas seulement `/login` (le reste du parcours prévu — dashboard, ingestion, admin, fiche de personnage, écran de partie, profil — reste à tester une fois ce point éclairci).
