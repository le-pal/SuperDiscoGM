# SuperDiscoGM — Documentation

Maître du Jeu Virtuel : une application où un ou plusieurs joueurs vivent une partie de jeu de rôle animée par une IA jouant le rôle de MJ, à partir d'un scénario fourni.

Ce dossier est le point d'entrée de la spécification fonctionnelle. Elle est répartie par lot pour rester lisible au fur et à mesure qu'elle grossit :

| Lot | Contenu | Spec | Questions ouvertes |
|---|---|---|---|
| **Admin** | Rôles & permissions, prompt système, persona MJ, budget API | [admin/spec.md](admin/spec.md) | [admin/questions.md](admin/questions.md) |
| **Scénario** | Campagne/Scénario/Session, pipeline d'ingestion, mémoire & contexte | [scenario/spec.md](scenario/spec.md) | [scenario/questions.md](scenario/questions.md) |
| **Partie** | Écran de jeu, temps réel, fiche de personnage, dés & règles | [partie/spec.md](partie/spec.md) | [partie/questions.md](partie/questions.md) |
| **Technique** | Stack, fournisseurs LLM, authentification, RGPD, hébergement | [technique/spec.md](technique/spec.md) | [technique/questions.md](technique/questions.md) |
| **Roadmap** | V1 → V4 | [roadmap.md](roadmap.md) | (questions V2-V4 réparties par lot concerné) |

**Convention** : chaque question a un identifiant global unique (`Q01`, `Q02`, ...) même réparti sur plusieurs fichiers, pour ne jamais avoir de collision. Statut `[ ]` ouverte · `[x]` tranchée. Chaque décision tranchée est reportée dans le `spec.md` du lot correspondant, référencée `[Qxx]`.

---

## 1. Vision produit

**SuperDiscoGM** est un Maître du Jeu Virtuel : une application où un (ou plusieurs) joueurs vivent une partie de jeu de rôle animée par une IA jouant le rôle de MJ, en s'appuyant sur un scénario fourni.

- Périmètre système de jeu V1 : **Donjons & Dragons** uniquement.
- Le **MJ est toujours une IA** — jamais un rôle tenu par un humain. Toute action attribuée au "MJ" (narration, publication d'images/contenu, mise en forme, décisions de jeu) est une action du MJ-IA. `[Q01]`
- **Multi-tenant dès la V1** : plusieurs parties/tables indépendantes tournent en parallèle sur la même instance (chacune avec ses propres joueurs, campagne, scénario). `[Q02]`
- **Coût des appels au modèle** : porté par un budget/clé API global géré par l'Admin. `[Q03]`

## 🐺 Loups levés (risques à ne pas perdre de vue)

Risques transverses identifiés au fil de l'analyse — à garder en tête pendant tout le développement, pas seulement au moment où la question correspondante est tranchée.

1. **Confusion du rôle MJ** — tranchée : le MJ est toujours l'IA (`[Q01]`). Images : aucune en V1, bibliothèque/générateur IA en V2 (`[Q28]`).
2. **Dés/règles laissés au LLM** — entièrement tranchée : dés en outil séparé (`[Q32]`), moteur de règles complet en outil (CA, dégâts, sorts, conditions — `[Q32b]`), et modifications de fiche perso obligatoirement via tool-call structuré (`[Q31b]`). Aucune règle n'est laissée à l'improvisation texte du MJ-IA.
3. **Résumé non hiérarchisé** — tranchée : hiérarchie à 3 niveaux dès la conception (session → arc → campagne), `[Q22]`, voir [scenario/spec.md](scenario/spec.md).
4. **Couche temps réel** — tranchée : temps réel dès la V1 (WebSocket/SSE), `[Q25]`.
5. **Pas de validation humaine du découpage en phases** — **risque accepté sciemment pour la V1** : le Super utilisateur a choisi de jouer directement sur le découpage automatique, sans étape de relecture obligatoire (`[Q15]`). À rouvrir si des sessions cassent en pratique à cause d'une mauvaise annotation.
6. **Canal privé joueur/MJ** — tranchée, avec un cas d'usage explicite (party split, `[Q26]`) et un reveal manuel géré par le MJ-IA au retour dans le fil principal (`[Q26b]`).

Reste ouvert : `[Q28]` (choix bibliothèque vs générateur IA, à trancher pour la V2), `[Q46b]` (structure/portée du bloc-notes joueur), `[Q49b]` (mécanique précise de l'indicateur de présence), `[Q51]` (ambiance dynamique par lieu), `[Q52]` (émotions par la couleur, piste V3), `[Q33]`/`[Q34]` (détails V2/V3), `[Q35]` (contenu V4 à challenger). **Stack technique tranchée** (`[Q36]`/`[Q37]`) : self-hosted Docker Compose, voir [technique/spec.md](technique/spec.md).
