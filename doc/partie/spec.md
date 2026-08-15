# Spec — Partie

Retour à [l'index](../index.md).

## Écran de partie

- Interface de base V1 : **chat** partagé entre les participants d'une partie.
- Chaque utilisateur a une **couleur unique**, appliquée **au contour du cadre de ses messages** (pas seulement au nom) — identification en un coup d'œil.
- Chaque joueur a accès à sa **fiche de personnage** (niveau de détail : `TBD [Q30]`).
- Le MJ-IA peut publier images, contenu, mise en forme dans le chat (déclencheur et source des images en V1 : `TBD [Q28]`).
- **Temps réel multi-utilisateurs dès la V1** (WebSocket/SSE) : tous les participants voient les messages des autres en direct. `[Q25]`
- **Canal privé joueur ↔ MJ, avec support explicite du "party split"** : le MJ-IA peut isoler un ou deux personnages et mener plusieurs échanges privés en parallèle pendant que le reste de la table continue/attend — pas qu'un simple canal 1-à-1. Un **repère système visible par tous** signale qu'un aparté a lieu, sans en révéler le contenu (restreint aux participants + MJ) — évite qu'un joueur non impliqué se demande pourquoi le fil semble figé. Mécanisme de reveal du contenu vers la table principale : reveal manuel par le MJ-IA. `[Q26]` `[Q26b]`
- **Texte libre + actions structurées clés** (ex: `/roll`, sélection de sort/objet) pour les actions mécaniques évidentes. `[Q27]`
- **Historique : scroll infini uniquement en V1**, export (PDF/journal) reporté à une version ultérieure (piste V4). `[Q29]`
- **Bloc-notes personnel par joueur, privé** : jamais lu par le MJ-IA ni les autres joueurs, sans impact sur le contexte envoyé au modèle. `[Q46]` Structure du contenu et portée (scénario vs campagne) : `TBD [Q46b]`.

## Tableau de bord

- Un Utilisateur (quel que soit son rôle) peut **participer à plusieurs parties en cours simultanément**, sur des campagnes/tables différentes — cohérent avec le multi-tenant (`[Q02]`). `[Q48]`
- **Indicateur de présence** : le tableau de bord montre si des participants sont déjà connectés sur une partie donnée, pour savoir en un coup d'œil si "il y a déjà quelqu'un dessus". `[Q49]` Mécanique précise (liste nominative vs compteur, notification d'arrivée) : `TBD [Q49b]`.
- La création/gestion de campagnes et scénarios reste un droit Super utilisateur (voir [admin/spec.md](../admin/spec.md)) ; le tableau de bord d'un simple Utilisateur montre ses parties rejointes, sans les actions de gestion.

## Avatar

- **V1 : bibliothèque prédéfinie** — l'utilisateur choisit une couleur, les initiales sont déduites automatiquement de son nom par défaut. `[Q50]`
- **L'utilisateur peut surcharger ses initiales et modifier son nom affiché** depuis la page profil. `[Q54]`
- **Image personnalisée reportée à la V2**, cohérent avec l'absence d'images de contenu en V1 (`[Q28]`), même si l'avatar est une question d'identité distincte du contenu narratif.
- L'avatar (couleur) est la même identité visuelle utilisée pour le contour des messages en partie, le tableau de bord et la gestion des utilisateurs (Admin).

## Ambiance visuelle dynamique (idée à spécifier)

- Piste anticipée : le thème visuel de l'écran de partie change selon le **lieu de la scène active** (grotte, jungle, ville...). L'effet doit être **marquant sur le fond même de la zone de conversation** (pas un simple accent discret) — validé sur la maquette (`ecran-partie.html`, dégradés de fond par ambiance). Les couleurs d'identité des joueurs restent fixes quelle que soit l'ambiance (l'identité ne doit jamais changer). Source de la palette (automatique via métadonnées de phase `[Q16]` vs pilotage manuel), et bibliothèque de thèmes vs génération dynamique : `TBD [Q51]`. Probable V2+.

## Émotions par la couleur (piste V3)

- Idée anticipée : une **mécanique pour représenter les émotions par la couleur**, en complément de l'ambiance de lieu ci-dessus. Ce que ça couvre exactement (émotions du MJ dans sa narration ? d'un PNJ ? ressenti d'un joueur ?), le support visuel (teinte de bulle, icône), la source (analyse de ton automatique vs balisage explicite du scénario) et comment ça ne rentre pas en collision avec les couleurs déjà prises (identité joueur, ambiance de lieu) restent à spécifier. `TBD [Q52]` — voir [roadmap.md](../roadmap.md).

## Fiche de personnage

- Système : D&D (V1).
- **Niveau de détail : version simplifiée** (PV, quelques traits clés), pourra être étoffée plus tard. `[Q30]`
- **Édition : le MJ-IA met à jour la fiche automatiquement** en fonction de ce qui est narré/résolu (PV, inventaire...). Le joueur garde la main sur ses choix propres (montée de niveau, etc.). `[Q31]`
- **Cohérence fiche ↔ narration : tool-call structuré obligatoire.** Le MJ-IA ne modifie jamais la fiche par simple texte généré — il passe par un outil structuré ("appliquer dégâts", "ajouter objet"...) au résultat déterministe et traçable ; la narration suit ce qui a été appliqué, jamais l'inverse. `[Q31b]`

## Dés & moteur de règles

- **Les dés sont un outil (tool) à part entière, séparé de toute génération texte du LLM.** Utilisable à la fois par le MJ-IA (jets qu'il déclenche pour résoudre une action) et directement par les utilisateurs (un joueur peut lancer lui-même ses dés). `[Q32]`
- **Moteur de règles complet en outil** : CA, calcul de dégâts, consommation d'emplacements de sorts, application de conditions — tout passe par des outils déterministes appelés par le MJ-IA, jamais improvisé en texte libre. `[Q32b]`
- **Jet non sollicité d'un joueur** : peut être annoncé dans le chat, mais le MJ-IA est libre de l'ignorer si ce n'était pas à sa demande — pas de portée automatique sur la narration. `[Q32c]`
