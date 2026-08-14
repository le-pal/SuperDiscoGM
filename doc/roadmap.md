# Roadmap — SuperDiscoGM

Retour à [l'index](index.md).

| Version | Contenu |
|---|---|
| **V1** | Ingestion d'un scénario complet ("on lui fait manger") + partie jouable en chat, D&D uniquement, **sans image** (`[Q28]`). Voir [scenario/spec.md](scenario/spec.md) et [partie/spec.md](partie/spec.md). |
| **V2** | Génération d'un nouveau scénario à partir d'une inspiration fournie par l'utilisateur (`[Q33]`, voir [scenario/questions.md](scenario/questions.md)) **+ le MJ-IA peut publier des images**, via bibliothèque ou générateur d'image IA (choix entre les deux à préciser — `[Q28]`, voir [partie/questions.md](partie/questions.md)). |
| **V3** | Génération de cartes via modèles en ligne (`[Q34]`, voir [scenario/questions.md](scenario/questions.md)) **+ mécanique de représentation des émotions par la couleur** (`[Q52]`, voir [partie/questions.md](partie/questions.md)). |
| **V4** | À définir — proposition ci-dessous, à trancher ensemble (`[Q35]`). |

## Proposition V4 (à challenger ensemble — Q35)

Quelques pistes, à trier/prioriser :

- **Moteur de règles + jet de dés déterministe** intégré comme outil (tool-call), avec journal des jets consultable par les joueurs (transparence anti-triche) — prolonge `[Q32b]`.
- **Suivi de combat / initiative** : tracker d'ordre de tour, PV, conditions (empoisonné, à terre...) synchronisé avec la fiche perso.
- **Narration audio (TTS)** pour les répliques du MJ + ambiance sonore générée selon le lieu/l'ambiance.
- **Génération de PNJ persistants** avec mémoire propre (un PNJ recroisé 10 sessions plus tard se souvient de l'interaction) — prolonge la mémoire par entité, `[Q45]`.
- **Support multi-systèmes** (au-delà de D&D 5e : Call of Cthulhu, Vampire...) via un moteur de règles modulaire/pluggable.
- **Export de la session** en journal de bord illustré (PDF/récap façon "roman" généré en fin de partie).
- **Bibliothèque/marketplace de scénarios** partageables entre utilisateurs (avec les personas et découpages déjà "digérés").
- **Intégration VTT existant** (Roll20/Foundry) pour les cartes/tokens plutôt que réinventer un éditeur de carte.
- **Mode asynchrone / play-by-post** : les joueurs ne sont pas tous connectés en même temps, le MJ-IA relance la partie au rythme des réponses (complémentaire du mode "table en direct").
- **Ambiance visuelle dynamique selon le lieu** (grotte, jungle, ville...) — idée anticipée par Philippe pendant la maquette, à spécifier (`[Q51]`, voir [partie/questions.md](partie/questions.md)). Les couleurs d'identité des joueurs restent fixes dans tous les cas.
