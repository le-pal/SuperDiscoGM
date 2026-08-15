# Idées de fonctionnalités — vivier brut

Retour à [l'index](index.md).

**Ce que c'est** : un brainstorm de fonctionnalités possibles, pas encore décidées — à ne pas confondre avec les `Qxx` (décisions actées) ni avec [roadmap.md](roadmap.md) (plan V1→V4 officiel). Certaines idées ci-dessous recoupent la proposition V4 de roadmap.md ; quand c'est le cas, c'est signalé et approfondi plutôt que dupliqué.

**Démarche** : plutôt que de deviner ce qui manque, recherche sur le net de vrais retours d'expérience — forums de MJ/joueurs (D&D Beyond, r/rpg, r/DnD, DungeonVault, Sly Flourish...), articles sur les frustrations des VTT existants (Roll20/Foundry), et surtout des retours spécifiques sur les **MJ pilotés par IA** (AI Dungeon et consorts) puisque c'est la comparaison la plus directe pour SuperDiscoGM. Chaque idée liée à une source concrète le mentionne.

**Notation** : chaque idée est notée de **1 à 10 sur la valeur ajoutée pour l'expérience utilisateur** (pas la facilité d'implémentation — c'est l'estimation de complexité, à côté, qui couvre ça). Discriminant volontairement : tout n'est pas à 8+.

---

## 1. Mémoire & confiance (le point le plus critique)

La recherche sur les MJ-IA existants (AI Dungeon et autres) est unanime : **l'oubli est la plainte n°1**, loin devant tout le reste — "memory is the most cited complaint across every AI tabletop community... players report that the AI forgets hit points, the world, and quest details" ([dungeonsdeep.ai](https://dungeonsdeep.ai/blog/why-ai-game-masters-forget-your-campaign-and-how-dungeonsdeepai-doesnt), [aiforsocialgood.ca](https://aiforsocialgood.ca/blog/ai-dungeon-broken-the-frustration-and-limitations-of-an-imperfect-ai-dungeon-master)). SuperDiscoGM a déjà une architecture pensée contre ça (résumés hiérarchiques `[Q22]`, mémoire par entité `[Q41]`-`[Q45]`) — mais l'architecture ne suffit pas si le joueur n'a jamais confiance que ça marche. Les idées ici visent la **confiance visible**, pas juste la mécanique interne.

- **Indicateur de mémoire visible** — un petit signal discret dans le chat quand le MJ-IA fait référence à un fait ancien ("se souvient de : le sceau gravé, scène 3") plutôt que de laisser le joueur deviner si l'IA a vraiment tout suivi. Directement en réponse au problème n°1 identifié en recherche. *Complexité : moyenne (UI + traçabilité du bloc mémoire déjà assemblé par `assembleTurnContext`).* — **Note : 9/10**
- **Recap de reprise de partie** — au moment de "Reprendre" une partie interrompue, un court résumé généré ("la dernière fois : ...") avant de replonger dans le chat brut, plutôt que d'attendre du joueur qu'il remonte l'historique lui-même. S'appuie directement sur le résumé de session déjà construit `[Q20]`. *Complexité : faible — le résumé existe déjà, il manque juste l'affichage au bon moment.* — **Note : 9/10**
- **Fiche d'entité consultable par les joueurs** — aujourd'hui la mémoire par entité (`EntityMemory`) n'est interrogeable que par le MJ-IA (`lookup_entity_history`, étape 31). Donner aux joueurs un accès en lecture ("qui est Grimsby déjà ?") réduirait la charge cognitive de devoir tout retenir soi-même. *Complexité : faible (UI + une route GET).* — **Note : 7/10**
- **Correction manuelle de la mémoire** — si le MJ-IA se trompe sur un fait (hallucination), permettre à un Super utilisateur de corriger une fiche `EntityMemory` directement plutôt que d'attendre que ça se corrige tout seul au fil des tours. *Complexité : faible.* — **Note : 6/10**

## 2. Mécaniques de jeu

- **Suivi de combat / initiative** *(déjà en piste V4, roadmap.md)* — creusé : la recherche confirme que l'initiative gérée à la main est une vraie source de lenteur/frustration côté MJ humain ("initiative mechanic feels like a needless chore", combats de 2h30-3h pour 3 rounds avec beaucoup de joueurs qui attendent sans rien faire, [dndbeyond.com forums](https://www.dndbeyond.com/forums/dungeons-dragons-discussion/dungeon-masters-only/228171-how-to-handle-slow-combat-with-a-large-group-and-complaining-players)). Pour un MJ-IA, l'opportunité est différente : pas besoin de tracker à la main, mais il faut éviter que les joueurs passent du temps mort en attendant leur tour dans un chat texte — pire que sur table où au moins on regarde les autres jouer. Le tool serait `advance_turn`/`get_initiative_order`, avec relance explicite au joueur suivant plutôt que d'attendre passivement. *Complexité : gros chantier (nouveau modèle de données + tools + UI dédiée).* — **Note : 8/10**
- **Sorts et capacités nommés** — gap concret identifié cette session : `CharacterSheet.spellSlots` ne stocke que des compteurs numériques par niveau (`{"1": 3}`), aucune liste de sorts/capacités connus par nom. La fiche de personnage (maquette) affiche pourtant "Sorts & capacités" comme texte libre — actuellement invérifiable/non structuré. *Complexité : moyenne (nouveau champ Json structuré + tool dédié).* — **Note : 7/10**
- **Butin et objets enrichis** — l'inventaire actuel est `{name, quantity}` seulement : pas de description, pas de rareté, pas d'objet magique avec effet mécanique. Pour une vraie campagne D&D qui dure, ça s'appauvrit vite. *Complexité : moyenne.* — **Note : 6/10**
- **Repos long/court et gestion du temps qui passe** — aucune notion de temps in-fiction actuellement (pas de jour/nuit, pas de repos qui régénère PV/emplacements de sorts autrement que par tool-call MJ ad hoc). Un vrai repos long comme mécanique nommée rendrait la fiche plus fiable et le MJ-IA plus cohérent sur la progression. *Complexité : moyenne.* — **Note : 6/10**
- **Règles maison / variantes de système** *(lié à la piste V4 "support multi-systèmes")* — même en restant D&D 5e V1, certaines tables jouent avec des variantes (dégâts max au niveau 1, règles d'encombrement simplifiées...). Un espace de config par campagne éviterait de attendre le multi-système complet pour ce genre de personnalisation légère. *Complexité : moyenne.* — **Note : 4/10**

## 3. Vie de table / dynamique de groupe

- **Équilibrage du temps de parole ("spotlight balance")** — un vrai problème documenté côté MJ humain : "no one wants to feel like a background extra... rotating focus... invite quieter players to step up" ([bjarkethebard.com](https://www.bjarkethebard.com/blog/sharing-the-spotlight-ttrpg), [thegamer.com](https://www.thegamer.com/dungeons-and-dragons-dnd-help-shy-players-dm-guide/)). Un MJ-IA peut structurellement mieux faire qu'un humain fatigué : après un nombre de tours sans qu'un participant donné se soit exprimé, le MJ-IA pourrait explicitement l'inviter ("Que fait Sable pendant ce temps ?") — la technique "third person / que fait ton personnage" citée en recherche est directement transposable en instruction de prompt système. *Complexité : faible-moyenne (instruction de prompt + un compteur de tours par participant à exposer en contexte).* — **Note : 8/10**
- **Notification "c'est à ton tour"** — dans un jeu asynchrone/multi-joueur, savoir qu'on est attendu (vs juste "il y a du nouveau") change beaucoup l'expérience. Actuellement le mode async play-by-post est une piste V4 non détaillée, mais même en V1 "table en direct", une notification différenciée "le MJ t'a nommément sollicité" serait utile. *Complexité : faible (un type de notification de plus sur l'infra déjà existante).* — **Note : 6/10**
- **Gestion propre de l'absence d'un joueur** — actuellement rien ne prévoit qu'un joueur soit injoignable pendant une session ; le MJ-IA n'a pas de notion de "ce joueur est absent, ne pas attendre sa réaction". À défaut, la partie risque de rester bloquée en attendant quelqu'un qui ne reviendra pas cette session. *Complexité : moyenne.* — **Note : 6/10**
- **Vote de groupe sur une décision clé** — pour les choix qui engagent toute la table (quel chemin prendre, faire confiance à un PNJ...), un mini-sondage intégré au chat plutôt que de laisser le joueur le plus rapide/bavard trancher pour le groupe. Renforce l'équilibrage du point précédent. *Complexité : moyenne.* — **Note : 5/10**

## 4. Sécurité émotionnelle & consentement

Absent actuellement de la spec (`doc/`) alors que c'est un standard établi du JDR moderne, d'autant plus pertinent avec un MJ-IA qui n'a pas le jugement social d'un humain pour sentir qu'il va trop loin.

- **Outil "X-card" numérique** — "the elegance of the X-Card is in removing the social cost of speaking up" ([campdragononline.com](https://www.campdragononline.com/blog/exploring-ttrpg-safety-tools-x-card-session-zero-and-more/)) : un bouton discret dans l'écran de partie qu'un joueur peut activer pour signaler "je veux que cette scène change de direction", sans justification, visible seulement du MJ-IA (qui doit alors dévier la narration) — pas des autres joueurs, pour ne pas exposer le geste. *Complexité : faible (un bouton + une instruction système claire).* — **Note : 8/10**
- **Lignes et voiles configurables par campagne** — "Lines... things you don't want to exist at all... Veils, things that can exist... but only off-screen" ([blog.roll20.net](http://blog.roll20.net/posts/guest-blog-an-introduction-to-lines-and-veils/)), à définir en amont (équivalent numérique d'une session zéro) et injectés dans le prompt système/persona pour contraindre structurellement ce que le MJ-IA peut aborder. Complète l'X-card (réactif) par du préventif. *Complexité : faible-moyenne (champ de config + injection dans le contexte de tour).* — **Note : 8/10**
- **Session zéro numérique** — un court questionnaire à la création de campagne (ton souhaité, thèmes à éviter, niveau de violence/horreur) qui alimente directement lignes/voiles et le choix de persona. Rendrait les deux points précédents plus faciles à remplir pour un utilisateur qui ne connaît pas ces termes. *Complexité : faible.* — **Note : 6/10**

## 5. Immersion audio/visuelle

- **Narration audio (TTS)** *(déjà en piste V4)* — creusé : voix distincte pour le MJ vs les PNJ marquants donnerait un vrai gain d'immersion, cohérent avec l'ambiance dynamique déjà construite (étape 40). *Complexité : gros chantier (fournisseur TTS, latence, coût par appel à ajouter au suivi de budget étape 48).* — **Note : 6/10**
- **Musique d'ambiance générée/sélectionnée par scène** *(lié à la piste V4 TTS)* — les vrais actual plays (Critical Role) misent beaucoup sur la musique pour le ton ; un lien vers une playlist par tag d'ambiance (déjà déduit pour les couleurs, étape 40) serait un prolongement naturel, moins cher qu'un vrai générateur audio. *Complexité : moyenne (playlist statique par ambiance) à gros chantier (génération dynamique).* — **Note : 5/10**
- **Portraits de PNJ générés** — mentionné comme V2 pour les images de contenu (`[Q28]`), mais spécifiquement pour les PNJ récurrents (pas juste des illustrations de scène ponctuelles) ça aide à la mémorisation/l'attachement — un visage associé à un nom compte beaucoup dans une vraie partie. *Complexité : dépend du choix bibliothèque vs génération IA déjà à trancher pour `[Q28]`.* — **Note : 6/10**

## 6. Après la partie (post-session)

Les actual plays professionnels misent énormément là-dessus : "the abridged episodes cut out introductions, ads, table chatter... keeping viewers engaged" ([sur Critical Role](https://www.yahoo.com/entertainment/thanks-abridged-version-actual-play-014854702.html)) — le résumé/highlight *après coup* est autant valorisé que la partie elle-même par les vrais joueurs/spectateurs.

- **Highlights automatiques de session** — extraire du fil de la session les 3-5 moments marquants (déjà indirectement matérialisés par ce que l'agent dédié juge "important" pour le résumé/la mémoire d'entité `[Q21]`) et les présenter comme un petit récap partageable en fin de session, plutôt que de les laisser noyés dans le résumé brut. *Complexité : moyenne (réutilise la mécanique existante, ajoute juste une présentation dédiée).* — **Note : 7/10**
- **Journal de campagne consultable** — une vue chronologique de tous les résumés de session d'une campagne (`Summary` niveau SESSION déjà stockés), consultable même hors partie, pour un joueur qui veut se remémorer l'histoire depuis le début. *Complexité : faible (les données existent déjà, juste une page de lecture).* — **Note : 7/10**
- **Statistiques de partie** — dés lancés, PNJ rencontrés, temps de jeu cumulé... amusant mais anecdotique par rapport aux items ci-dessus. *Complexité : faible.* — **Note : 3/10**
- **Export PDF/journal illustré** *(déjà en piste V4)* — confirmé pertinent par la recherche (goût marqué des joueurs pour les recaps/résumés soignés) mais gros chantier de mise en page, à ne pas prioriser avant les deux premiers points de cette section qui donnent 80% de la valeur pour 20% de l'effort. — **Note : 5/10**

## 7. Outils pour le Super utilisateur (supervision)

Le MJ est toujours l'IA `[Q01]`, mais le Super utilisateur qui a créé la campagne garde un rôle de supervision — actuellement limité à la gestion admin (personas, invitations) sans aucun outil de pilotage en cours de partie.

- **Réglage du ton en direct** — un curseur simple ("plus sombre" / "plus léger", "ralentis le rythme" / "accélère vers la fin") que le Super utilisateur peut ajuster pendant la partie sans devoir rééditer tout le prompt système ou la persona. *Complexité : moyenne (nouveau canal d'instruction injecté dans le contexte de tour, distinct du prompt système versionné).* — **Note : 6/10**
- **Pense-bête de préparation** — un espace de notes visible seulement du Super utilisateur (distinct du bloc-notes privé des joueurs, `[Q46]`) pour préparer des éléments à venir (un rebondissement prévu, un PNJ à introduire) sans que ça pollue le scénario digéré officiel. *Complexité : faible (même mécanique que PlayerNote, juste un rôle différent).* — **Note : 5/10**
- **Intervention manuelle ponctuelle** — pouvoir injecter une instruction ponctuelle au MJ-IA sans que ce soit un vrai message de chat visible ("fais intervenir la garde maintenant") pour corriger le tir en cas de dérive, sans casser l'immersion des joueurs. *Complexité : moyenne.* — **Note : 6/10**

## 8. Expérience utilisateur générale

- **Mobile / responsive réel** — rien dans la session n'a validé l'écran de partie sur petit écran ; le chat + sidebar fiche perso construits cette session sont pensés desktop d'abord. Pour une table qui joue depuis son téléphone (cas fréquent en JDR asynchrone), c'est probablement bloquant en l'état. *Complexité : moyenne (CSS/layout, pas de nouvelle logique).* — **Note : 7/10**
- **Onboarding d'un nouveau joueur en cours de campagne** — rejoindre une campagne déjà bien avancée (via invitation) largue le nouveau joueur sans contexte ; un résumé d'accueil généré ("voici où en est l'histoire") réutiliserait le même mécanisme que le "recap de reprise" (section 1) appliqué à un nouvel arrivant plutôt qu'un joueur qui revient. *Complexité : faible.* — **Note : 6/10**
- **Accessibilité (lecteur d'écran, contraste, taille de police)** — jamais mentionné dans `doc/`, jamais testé cette session. Pas glamour mais un vrai manque pour l'ouverture à un public plus large. *Complexité : moyenne (revue systématique, pas un gros chantier isolé).* — **Note : 5/10**
- **Personnalisation visuelle au-delà de l'avatar** — thème clair/sombre au choix du joueur (indépendant de l'ambiance de lieu, étape 40, qui elle doit rester automatique), taille de police du chat. *Complexité : faible.* — **Note : 4/10**

## 9. Découverte & communauté

- **Bibliothèque/marketplace de scénarios** *(déjà en piste V4, roadmap.md)* — non creusé plus loin ici, la proposition existante est déjà bien cadrée.
- **Recherche de table (LFG — "looking for group")** — rien dans SuperDiscoGM n'aide à *constituer* un groupe, seulement à jouer une fois qu'il existe. Hors périmètre probable (l'app n'est pas un réseau social), mais à noter comme frontière consciente plutôt que comme oubli. *Complexité : gros chantier, et débat de périmètre avant même l'implémentation.* — **Note : 2/10**

---

## Top 10 (triées par note)

| # | Idée | Catégorie | Note |
|---|---|---|---|
| 1 | Indicateur de mémoire visible | Mémoire & confiance | 9 |
| 1 | Recap de reprise de partie | Mémoire & confiance | 9 |
| 3 | Équilibrage du temps de parole ("spotlight balance") | Vie de table | 8 |
| 3 | Suivi de combat / initiative | Mécaniques | 8 |
| 3 | Outil "X-card" numérique | Sécurité émotionnelle | 8 |
| 3 | Lignes et voiles configurables | Sécurité émotionnelle | 8 |
| 7 | Fiche d'entité consultable par les joueurs | Mémoire & confiance | 7 |
| 7 | Sorts et capacités nommés | Mécaniques | 7 |
| 7 | Highlights automatiques de session | Post-session | 7 |
| 7 | Journal de campagne consultable | Post-session | 7 |
| 7 | Mobile / responsive réel | UX générale | 7 |

**Lecture rapide** : les quatre notes les plus hautes (mémoire visible, recap de reprise, X-card, lignes et voiles) ont un point commun — ce sont toutes des réponses directes à des problèmes documentés par de vrais utilisateurs (de MJ-IA pour les deux premières, de JDR en général pour les deux dernières), et toutes à complexité faible ou moyenne. C'est le meilleur rapport valeur/effort du tas — à considérer avant les chantiers plus lourds (combat/initiative, TTS) qui ont une bonne note mais coûtent nettement plus cher.
