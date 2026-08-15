# Questions — Partie

Retour à [l'index](../index.md). Statut : `[ ]` ouverte · `[x]` tranchée (voir [spec.md](spec.md)).

## Écran de partie / UX temps réel

- **Q25.** `[x]` Le chat est-il **temps réel multi-utilisateurs** (WebSocket, tous les joueurs voient les messages des autres en direct) ?
  → **Décision : oui, temps réel dès la V1** (WebSocket/SSE), cohérent avec "l'écran géant de chat" et le multi-tenant (`[Q02]`).
- **Q26.** `[x]` Existe-t-il un canal **privé joueur ↔ MJ** en plus du chat de table ?
  → **Décision : oui, avec un cas d'usage explicite à prévoir by design — l'isolement de sous-groupe ("party split").** Le MJ-IA doit pouvoir isoler un ou deux personnages et mener des échanges **privés en parallèle** avec plusieurs sous-groupes en même temps pendant que le reste de la table continue ou attend.
- **Q26b.** `[x]` Quand un sous-groupe isolé revient dans le fil principal, comment le reste de la table prend-il connaissance de ce qui s'est passé en privé ?
  → **Décision : reveal manuel par le MJ-IA**, qui dose narrativement le bon moment pour révéler (ou garder caché) ce qui s'est passé en privé — cohérent avec un vrai MJ qui gère l'information selon l'histoire.
- **Q27.** `[x]` Les actions des joueurs sont-elles en texte libre uniquement, ou existe-t-il aussi des actions structurées ?
  → **Décision : texte libre + actions structurées clés** (ex: `/roll`, sélection de sort/objet) pour les actions mécaniques évidentes — cohérent avec les dés en outil séparé (`[Q32]`).
- **Q28.** `[x]` "Le MJ met des images/contenu/mise en forme" — qui déclenche ça, et depuis quelle source ?
  → **Décision : pas d'images en V1.** À partir de la V2, image via une bibliothèque ou un générateur d'image IA (choix entre les deux à préciser quand on spécifiera la V2 — voir [roadmap.md](../roadmap.md)). Le MJ-IA garde en V1 la capacité de mise en forme/contenu texte, sans image.
- **Q29.** `[x]` Historique de session : scroll infini, pagination, export du log de la partie (PDF) ?
  → **Décision : scroll infini uniquement en V1.** L'export (PDF/journal) est reporté à une version ultérieure (déjà listé en piste V4, [roadmap.md](../roadmap.md)).
- **Q46.** `[x]` Le bloc-notes personnel d'un joueur : visible uniquement par lui, ou aussi consultable par le MJ-IA ?
  → **Décision : privé au joueur uniquement.** Jamais lu par le MJ-IA ni les autres joueurs — un vrai carnet de notes personnel, sans impact sur le contexte envoyé au modèle. Structure du contenu (libre vs champs guidés) et portée (scénario vs campagne) : `TBD [Q46b]`.

## Fiche de personnage & règles D&D

- **Q30.** `[x]` Niveau de détail de la fiche perso en V1 ?
  → **Décision : version simplifiée** (PV, quelques traits clés) — pourra être étoffée plus tard.
- **Q31.** `[x]` Qui édite la fiche : le joueur en autonomie, ou le MJ-IA la met-elle à jour automatiquement ?
  → **Décision : le MJ-IA met à jour automatiquement** la fiche en fonction de ce qui est narré/résolu (PV, inventaire...). Le joueur garde la main sur ses choix propres (ex: compétences à la montée de niveau).
- **Q31b.** `[x]` Quel mécanisme garantit la cohérence fiche ↔ narration ?
  → **Décision : tool-call structuré obligatoire.** Le MJ-IA ne modifie jamais la fiche par simple texte généré : il passe par un outil structuré ("appliquer dégâts", "ajouter objet"...) au résultat déterministe et traçable — la narration suit ce qui a été appliqué, jamais l'inverse.
- **Q32.** `[x]` Y a-t-il un **moteur de règles déterministe** (jets de dés...) séparé du LLM ?
  → **Décision : les dés sont un outil (tool) à part entière**, utilisable par le MJ-IA et directement par les utilisateurs.
- **Q32b.** `[x]` Au-delà du simple jet de dé : la validation des règles est-elle aussi portée par un moteur déterministe ?
  → **Décision : oui, moteur de règles complet en outil.** CA, calcul de dégâts, consommation d'emplacements de sorts, application de conditions passent tous par des outils déterministes que le MJ-IA appelle — jamais improvisés en texte libre. Cohérent avec `[Q31b]` et l'esprit anti-triche déjà acté pour les dés.
- **Q32c.** `[x]` Quand un joueur lance lui-même ses dés (hors sollicitation du MJ), comment le résultat remonte-t-il au MJ-IA ?
  → **Décision : le joueur peut l'annoncer dans le chat, mais le MJ-IA a la liberté de l'ignorer si ce n'était pas à sa demande.** Un jet non sollicité n'a donc pas de portée automatique sur la narration — c'est au MJ-IA d'estimer s'il en tient compte ou non.

## Retours sur la maquette visuelle (`maquette/`)

- **Clarification Q25** : la couleur unique d'un joueur s'applique **au contour du cadre de son message**, pas seulement au nom — identification en un coup d'œil dans le fil de chat.
- **Clarification Q26/Q26b** : quand un party split a lieu, un **repère système visible par tous** signale qu'un aparté est en cours ("Elyon et Kara s'isolent avec Grimsby"), sans révéler le contenu — seul le **contenu** de l'aparté est restreint aux participants + MJ. Évite qu'un joueur non impliqué se demande pourquoi le fil semble figé.

- **Q47.** `[x]` La fiche de personnage est-elle liée à une campagne ?
  → **Décision (actée par Philippe) : oui.** Un joueur a **une fiche par campagne** — s'il participe à plusieurs campagnes, il a plusieurs fiches distinctes. Cohérent avec la persistance au niveau campagne déjà actée pour la mémoire d'entités (`[Q45]`).
- **Q48.** `[x]` Un Utilisateur peut-il participer à plusieurs parties en cours simultanément ?
  → **Décision (actée par Philippe) : oui.** Cohérent avec le multi-tenant (`[Q02]`) — un même utilisateur peut avoir plusieurs parties actives sur des tables/campagnes différentes, pas seulement le Super utilisateur qui les crée.
- **Q49.** `[x]` Faut-il un indicateur de présence (qui est déjà connecté sur une partie donnée) sur le tableau de bord ?
  → **Décision (actée par Philippe) : oui**, "idéalement il faudrait pouvoir voir si il y a déjà quelqu'un dessus". Mécanique précise (liste nominative des connectés vs simple compteur, notification si quelqu'un rejoint) : `TBD [Q49b]`.
- **Q50.** `[x]` Gestion des avatars ?
  → **Décision : en V1, bibliothèque prédéfinie de couleurs/initiales** (l'utilisateur choisit une couleur, les initiales sont déduites de son nom). **Image personnalisée reportée à la V2**, cohérent avec l'absence d'images de contenu en V1 (`[Q28]`) — même si l'avatar est une question d'identité distincte du contenu narratif.
- **Q54.** `[x]` Amende `[Q50]` (actée par Philippe) : l'utilisateur peut-il personnaliser ses initiales et son nom affiché, plutôt que de dépendre uniquement de la déduction automatique ?
  → **Décision : oui.** Depuis la page profil, l'utilisateur peut modifier son nom affiché et surcharger ses initiales (sinon toujours déduites automatiquement du nom, comportement par défaut inchangé). La couleur reste la bibliothèque prédéfinie `[Q50]`.
- **Q51.** `[ ]` Thème visuel **dynamique selon le lieu de la scène** (grotte, jungle, ville... les couleurs changent) — idée à anticiper (Philippe). À spécifier : la palette est-elle déduite automatiquement du tag "lieu" des métadonnées de phase (`[Q16]`), ou pilotée manuellement ? Bibliothèque de thèmes prédéfinis vs génération dynamique de palette ? Les couleurs des joueurs (identité, `[Q25]`) doivent en tout cas rester fixes quelle que soit l'ambiance. Probable V2+ — voir [roadmap.md](../roadmap.md).
- **Q52.** `[ ]` Piste V3 (Philippe) : **mécanique pour montrer les émotions grâce aux couleurs.** À spécifier : quelles émotions/tons couvrir, appliqué à quoi exactement (bulle de narration du MJ, texte, un simple icône/indicateur), source (analyse de ton faite par le MJ-IA vs balise explicite posée dans le scénario digéré), et comment éviter une collision de sens avec les couleurs déjà utilisées ailleurs (identité joueur `[Q25]`, ambiance de lieu `[Q51]`). Voir [roadmap.md](../roadmap.md).
