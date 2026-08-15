# Réflexion — Vers une plateforme de règles générique

Retour à [l'index](../index.md). Document de réflexion (pas une spec tranchée) — précède tout code, demande explicite de Philippe. Prolonge l'idée déjà notée en piste V4 (`[Q35]`, [roadmap.md](../roadmap.md) : *"Support multi-systèmes (au-delà de D&D 5e...) via un moteur de règles modulaire/pluggable"*) — ce document ne l'invente pas, il la prend au sérieux plus tôt que prévu et propose comment la construire sans réécrire ce qui existe.

**Tension à garder en tête** : le périmètre V1 acté dit *"Système de jeu V1 : Donjons & Dragons uniquement"* ([index.md](../index.md)). Ce document ne remet pas cette décision en cause — il propose une architecture qui permet de **livrer V1 tel quel** tout en évitant que le prochain système (V2+) coûte une réécriture complète. Voir §6 pour où tracer la ligne.

## 1. Le problème, concrètement

Ce qui est câblé en dur aujourd'hui, fichier par fichier :

- **`CharacterSheet`** (`schema.prisma`) : colonnes fixes `name/className/race/level/hp/hpMax/ac/stats/inventory/conditions/spellSlots`. `stats` est un `Json`, mais son contenu (FOR/DEX/CON/INT/SAG/CHA) est recopié en dur côté UI (`STAT_LABELS` dans `apps/web/src/app/campaigns/[id]/character-sheet/page.tsx`). Un système sans ces 6 caractéristiques, ou avec des ressources différentes (mana, stress, sanité façon Cthulhu, points de destin façon FATE), n'entre pas dans ce modèle.
- **Le moteur de règles** (`packages/llm/src/tools/characterSheetLogic.ts` + `characterSheet.ts`) : une fonction TypeScript par mécanique (`applyDamage`, `applyHeal`, `addItem`, `removeItem`, `addCondition`, `removeCondition`, `consumeSpellSlot`), chacune enveloppée à la main en tool `ai` SDK avec un schéma zod écrit à la main. Ajouter une mécanique = écrire une fonction + un tool + retoucher l'UI, à la main, à chaque fois.
- **`turnContext.ts`** : le bloc "Personnages de la table" (voir `turnEngine.ts`, `sheetsBlock`) suppose implicitement le format de fiche actuel.
- **L'UI** (fiche complète, panneau condensé sidebar `CharacterSheetSummary`, formulaire de création `new-sheet-form.tsx`) : câblée directement sur les colonnes Prisma fixes, dupliquée à trois endroits.

Ce qui, à l'inverse, **est déjà générique** et n'a pas besoin de changer :
- **Les dés** (`packages/llm/src/tools/dice.ts`) : une formule `NdM+K` couvre n'importe quel système. Bon exemple à suivre.
- **`addItem`/`removeItem`** (inventaire) et **`addCondition`/`removeCondition`** (tags de statut) : déjà des opérations génériques sur une liste nommée — seul le *contenu* varie par système, pas la *mécanique*.
- **Le pattern tool-call déterministe + journal** (`CharacterSheetLog`, jamais d'improvisation texte libre `[Q31b]`/`[Q32b]`) — invariant produit, à garder tel quel quel que soit le système.
- **Le contexte de tour à 5 blocs**, le party split, la mémoire par entité, les résumés hiérarchiques — tout ça est déjà système-agnostique dans son principe (aucun ne présuppose D&D), seul le bloc "personnages de la table" a un souci de forme, pas de fond.

## 2. Précédents dans l'industrie

- **Foundry VTT** — le précédent le plus abouti : chaque "système de jeu" (dnd5e, pf2e, Call of Cthulhu...) est un package séparé qui définit un modèle de données pour les fiches (Actor Data Model), les types d'objets, des templates de fiche (Handlebars + CSS), et des formules de jet. Le moteur central est système-agnostique et expose des hooks. Ce qu'on en retient : **séparer clairement "moteur" et "système"**, et faire du système une définition versionnée, pas du code jeté au milieu du moteur.
- **Roll20** — fiches en HTML/CSS/JS template par système, avec des "sheet workers" JS qui réagissent aux changements d'attribut. Beaucoup plus permissif que Foundry, mais ça a un coût connu dans l'écosystème Roll20 : les attributs sont référencés par des chaînes de caractères libres un peu partout, fragile, difficile à faire évoluer sans casser des fiches existantes. **À éviter** : notre équivalent d'un "nom d'attribut en chaîne libre non validée" doit rester un identifiant défini et versionné par le système, jamais du texte inventé à la volée par qui que ce soit (y compris le MJ-IA).
- **FATE / Powered by the Apocalypse (PbtA)** — systèmes narratifs légers avec un vocabulaire mécanique volontairement minimal (Aspects, Skills, Stress tracks, Consequences pour FATE ; Moves, Stats, Harm clocks pour PbtA). Utile ici non pas comme précédent d'*architecture logicielle* mais comme preuve que **peu de "types de mécanique" génériques couvrent énormément de systèmes réels** — c'est exactement l'hypothèse dont dépend l'approche recommandée en §4.

Contrainte spécifique à ce projet qu'aucun de ces précédents n'a : le consommateur principal de la définition de règles n'est pas qu'un humain qui remplit un formulaire, c'est un **LLM qui doit appeler des outils de façon fiable**. Cette session a déjà mesuré empiriquement ce risque : sur 22 tours de simulation avec des prompts insistants, le modèle local (`qwen3.5:9b`) n'a déclenché qu'**un seul** tool-call spontané (voir rapport de simulation, `.claude/skills/simulate-quest/`). Plus les tools sont génériques/abstraits, plus ce risque empire — un `modify_resource(resourceId, amount)` générique est plus ambigu pour un modèle qu'un `apply_damage(amount)` nommé. C'est la contrainte qui structure la recommandation ci-dessous.

## 3. Approches envisagées

**A — Sac d'attributs totalement générique.** Un `GameSystem` définit une liste de "ressources" (nom, type, min/max, visibilité) et d'"actions" (effet sur une ressource, formule). La fiche devient `{ resources: Json }`. Les tools sont entièrement génériques (`modify_resource`, `set_attribute`...).
→ Maximum de flexibilité, mais deux problèmes : (1) affaiblit encore la fiabilité du tool-calling déjà fragile (des noms de tool génériques donnent moins de prise au modèle qu'un verbe métier précis) ; (2) l'UI générée à partir d'un sac de ressources sans forme (pas de distinction "ceci est une barre de vie" vs "ceci est un compteur d'emplacements de sorts") rend une interface plus pauvre que l'actuelle.

**B — Vocabulaire fixe mais composable de "types de capacité".** Au lieu d'un seul concept générique, un petit nombre fixe de "types de capacité" que chaque système compose : **ressource numérique bornée** (PV, mana, stress — un seul tool `adjust_resource` couvre TOUTES car la sémantique "un nombre qui monte/descend entre 0 et un max" est réellement uniforme), **track/compteur à crans** (emplacements de sorts par niveau, munitions, usages/jour — `consume_track`/`refill_track`), **liste de tags** (conditions — déjà `add_tag`/`remove_tag`, ce qui existe), **inventaire** (déjà générique), **attribut narratif/mécanique** (FOR/DEX, ou Aspects FATE — `update_attribute`). Chaque `GameSystem` définit QUELLES instances de ces capacités existent, avec leurs libellés/bornes — pas de nouveaux *types* de capacité par système, juste de nouvelles *instances*.
→ Préserve des noms de tool précis et un nombre de tools borné (5-7, pas un par mécanique ni un seul générique) tout en couvrant D&D, un système d'horreur, un système narratif léger. C'est une évolution de l'existant, pas une réécriture : `addItem`/`removeItem`/`addCondition`/`removeCondition` sont déjà exactement cette forme ; seuls `applyDamage`/`applyHeal` (→ `adjust_resource("hp", delta)`) et `consumeSpellSlot` (→ `consume_track("spellSlots", level)`) doivent être généralisés.

**C — Système = code, façon plugin Foundry.** Chaque système est un module TypeScript qui implémente une interface commune (tools, schéma de fiche, rendu UI) — pas de déclaratif du tout.
→ Le plus expressif, mais ne répond pas à la demande ("interface générique... configurable") : ajouter un système reste un chantier de développement à chaque fois, pas une configuration. Reste une porte de sortie valable pour un système vraiment atypique qui ne rentre dans aucune capacité de B — à garder en tête comme échappatoire de secours, pas comme approche principale.

## 4. Direction recommandée : B

Un vocabulaire fixe et restreint de types de capacité (ressource numérique, track, tags, inventaire, attribut), composé par système via une définition déclarative versionnée. Justification :

1. **Le risque le plus concret déjà mesuré cette session est la fiabilité du tool-calling**, pas le manque de flexibilité — B est la seule approche des trois qui ne l'aggrave pas (les noms de tool restent métier, pas génériques).
2. **C'est une évolution, pas une réécriture** : la moitié du moteur de règles actuel (dés, inventaire, conditions) est déjà dans cette forme. Le travail réel se limite à généraliser 2 mécaniques (dégâts/soins, emplacements de sorts) et à sortir les libellés (FOR/DEX/CON...) du code React vers une définition de données.
3. **L'UI reste riche** : une "ressource numérique" se rend en barre, un "track" en pastilles/cases à cocher, des "tags" en badges — le générateur d'UI garde une sémantique visuelle par type de capacité, contrairement à A où tout finirait en liste plate.

### Ce que ça implique concrètement (à un niveau conception, pas de code ici)

- **`GameSystem`** (nouvelle entité, versionnée comme `PromptVersion` — un système qui change ne doit pas faire bouger les fiches déjà créées sous une version antérieure) : nom, description, et une définition composée de `resourceDefs[]` / `trackDefs[]` / `tagCategoryDefs[]` / `attributeDefs[]`, chacun avec `{ key, label, min?, max?, visibleToPlayers, ... }`.
- **`Campaign.gameSystemId`** (remplace l'hypothèse implicite "toujours D&D-like") — choisi à la création de la campagne.
- **`CharacterSheet`** perd ses colonnes mécaniques fixes au profit de `resources: Json / tracks: Json / attributes: Json` (garde `inventory`/`conditions` tels quels, déjà génériques) + une référence au `gameSystemId` de sa campagne. Les champs purement narratifs (nom du personnage, race, classe en tant que texte descriptif) restent-ils des colonnes "identité" séparées des mécaniques, ou deviennent-ils eux-mêmes des `attributeDefs` du système ? **Question ouverte, voir `[Q57]`.**
- **Générateur de tools** : au chargement d'une partie, lit le `GameSystem` de la campagne et construit les tools (`adjust_resource`, `consume_track`, `add_tag`, `remove_tag`, `add_item`, `remove_item`, `update_attribute`) avec un schéma zod dont les clés valides (`resourceId`, `trackId`...) sont un **enum généré à partir de la définition** — le modèle ne peut pas halluciner une clé qui n'existe pas dans le système actif, l'erreur de type est structurellement impossible plutôt que découverte à l'exécution.
- **Générateur d'UI** : un composant `<GenericCharacterSheet system={def} sheet={data}>` unique, piloté par la même définition, remplaçant les 3 endroits actuellement dupliqués (fiche complète, panneau condensé, formulaire de création) par une seule source de vérité partagée avec le générateur de tools.
- **`turnContext.ts`** : le bloc "personnages de la table" change de source (lit la fiche générique au lieu des colonnes fixes) mais la structure à 5 blocs ne change pas.

## 5. Migration : le D&D actuel devient le premier `GameSystem`

Pas de coupure nette. Un `GameSystem` "D&D-like simplifié" reproduit exactement les champs actuels sous forme de définition : PV en ressource numérique, emplacements de sorts en tracks par niveau, FOR/DEX/CON/INT/SAG/CHA en attributs, CA en attribut spécial. Les campagnes existantes pointent dessus par défaut. Une migration de données mappe les colonnes fixes actuelles vers les nouveaux champs Json — mécanique, pas une refonte de contenu. Le pattern tool-call + journal, le parti split, la mémoire d'entité, les dés : **rien de tout ça ne bouge**.

## 6. Portée — quand construire ça ?

Le périmètre V1 acté est "D&D uniquement" — livrer V1 ne nécessite pas d'avoir plusieurs systèmes en production. Mais **construire le moteur de règles actuel en gardant cette architecture en tête maintenant** coûte relativement peu (le moteur actuel généralise déjà à moitié) et évite une réécriture complète le jour où V4/`[Q35]` "support multi-systèmes" est activé. Recommandation : traiter ça comme un chantier V2 concret plutôt qu'une piste V4 vague — mais c'est un arbitrage de priorité produit, pas un choix technique : **voir `[Q59]`.**

## 7. Nouvelles questions ouvertes (pas tranchées ici — voir [questions.md](questions.md))

- `[Q55]` Où vit la définition d'un `GameSystem` — formulaire Admin, ou fichier de config versionné dans le repo pour commencer ?
- `[Q56]` Un Super utilisateur peut-il créer/personnaliser son propre `GameSystem`, ou seulement choisir parmi des systèmes proposés par l'Admin ?
- `[Q57]` Les champs narratifs (nom du personnage, race, classe en texte libre) : bucket d'attributs générique du système, ou bloc "identité" toujours présent séparé des mécaniques ?
- `[Q58]` Politique de versionnage d'un `GameSystem` qui change après que des fiches existent déjà dessus — même esprit que `PromptVersion` (undo-log), ou quelque chose de différent (les mécaniques ne sont pas du texte librement réversible) ?
- `[Q59]` Ce chantier devient-il un objectif V2 concret, ou reste-t-il en piste V4 (`[Q35]`) le temps que V1 se stabilise ?
