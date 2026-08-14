# Questions — Scénario

Retour à [l'index](../index.md). Statut : `[ ]` ouverte · `[x]` tranchée (voir [spec.md](spec.md)).

## Modèle de données

- **Q10.** `[x]` Relation exacte entre Campagne et Scénario : chapitres enchaînés ? réutilisable entre campagnes ?
  → **Décision : une campagne enchaîne plusieurs scénarios (chapitres). Un scénario "digéré" est réutilisable dans plusieurs campagnes**, comme un module indépendant.
- **Q11.** `[x]` Une "partie" = combien de sessions, et "reprendre" veut dire quoi ?
  → **Décision : un scénario se joue sur plusieurs sessions.** "Reprendre une partie" recharge l'état exact où elle s'est arrêtée (phase active, résumé, mémoire des entités).
- **Q12.** `[x]` Le groupe de joueurs est-il figé pour toute la campagne ?
  → **Décision : groupe souple**, les joueurs présents peuvent varier d'une session à l'autre ; le MJ-IA s'appuie sur la mémoire de campagne pour s'adapter.

## Pipeline d'ingestion (V1 — "on lui fait manger")

- **Q13.** `[x]` Format d'entrée en V1 : texte brut collé uniquement, ou aussi upload de fichier ?
  → **Décision : texte collé + upload de fichiers (PDF/docx/markdown) dès la V1.**
- **Q13b.** `[x]` Images/cartes dans un fichier uploadé : traitées comment en V1 ?
  → **Décision : ignorées en V1 (seul le texte est extrait), mais le pipeline doit être conçu dès maintenant pour les accueillir plus tard** (point d'extension prévu, pas une refonte surprise en V-ultérieure).
- **Q14.** `[x]` La commande d'analyse est-elle synchrone ou asynchrone ?
  → **Décision : asynchrone avec notification** à la fin du traitement.
- **Q15.** `[x]` Le découpage automatique en phases est-il relu/validé par un humain avant mise en jeu ?
  → **Décision : non, utilisé tel quel.** Risque accepté sciemment pour la V1 (voir [index.md](../index.md) § Loups levés).
- **Q16.** `[x]` Quelle granularité pour une phase, et quelles métadonnées ?
  → **Décision : la scène, avec métadonnées structurées** (PNJ présents, lieu, conditions d'entrée/sortie, secrets à révéler).
- **Q17.** `[x]` Comment détecte-t-on la transition d'une phase à l'autre pendant le jeu ?
  → **Décision : détection automatique par le MJ-IA**, qui compare la conversation en cours aux conditions de sortie définies dans les métadonnées de la phase active (`[Q16]`).
- **Q18.** `[x]` Le scénario "digéré" est-il figé une fois analysé, ou peut-il être ré-annoté après coup ?
  → **Décision : modifiable, avec ré-analyse.** Une session en cours continue avec l'ancien découpage jusqu'à sa fin — pas de casse en direct si le Super utilisateur édite le scénario pendant qu'une partie tourne dessus.

## Gestion du contexte / mémoire

C'est la partie la plus critique techniquement — à cadrer précisément avant tout dev.

- **Q19.** `[x]` Ordre de priorité de troncature si le budget de contexte est dépassé ?
  → **Décision : les "dernières conversations" (fenêtre de messages bruts) sont raccourcies en premier.** Scénario digéré, résumé, fiches entités pertinentes et prompt système+persona restent prioritaires.
- **Q20.** `[x]` Qui/quoi maintient le résumé, à quel rythme ?
  → **Décision : un agent dédié met à jour le résumé après chaque tour/échange significatif**, en continu (pas seulement en fin de session — la partie peut être coupée à tout moment).
- **Q21.** `[x]` "Actions importantes des joueurs" — extraction automatique ou manuelle ?
  → **Décision : extraction automatique par un agent dédié**, qui juge en continu ce qui est important (décision de quête, mort d'un PNJ, objet obtenu...) et l'ajoute au journal structuré.
- **Q21b.** `[ ]` Quel schéma de données pour ce journal structuré (liste d'événements typés, journal de quêtes, inventaire, timeline) ?
- **Q22.** `[x]` Prévoit-on une hiérarchie de résumés sur une campagne longue ?
  → **Décision : oui, hiérarchie à 3 niveaux dès la conception** — résumé de session → consolidé en résumé d'arc/scénario → consolidé en résumé de campagne. Évite que le résumé lui-même redevienne le problème de contexte sur une longue campagne.
- **Q23.** `[x]` Entre deux scénarios d'une même campagne, quelles infos "survivent" vs quelles infos restent locales au scénario ?
  → **Décision (synthèse de `[Q10]` + `[Q45]`) : la mémoire par entité (PNJ, lieux, factions, quêtes) survit au niveau de la campagne** et traverse les scénarios. **Le découpage en phases et les secrets propres à un scénario restent attachés à ce scénario** (c'est un module indépendant, réutilisable tel quel dans d'autres campagnes, `[Q10]`) — il n'y a pas de fuite d'un scénario vers l'autre au-delà de la mémoire d'entité partagée par la campagne.

### Mémoire indexée par entité

Point de départ donné par Philippe : *"si on croise une personne on garde les interactions importantes en dessous, et d'éventuels index si on a besoin d'aller chercher les échanges en détail."* Modèle proposé et validé en principe dans [spec.md](spec.md) — détails restant à trancher :

- **Q41.** `[x]` Quels types d'entités sont suivis ?
  → **Décision : PNJ, lieux, factions et quêtes actives.**
- **Q42.** `[x]` Qui déclenche l'écriture dans une fiche entité ?
  → **Décision : extraction automatique par un agent**, cohérent avec `[Q20]`/`[Q21]` (même agent ou agent sœur que celui qui maintient le résumé et le journal d'actions).
- **Q43.** `[x]` Granularité de l'index ?
  → **Décision : par échange/scène**, cohérent avec la granularité "scène" déjà choisie pour les phases (`[Q16]`).
- **Q44.** `[x]` La récupération du détail brut se fait-elle automatiquement ou à la demande ?
  → **Décision (modèle en deux temps) : la fiche résumé courte de chaque entité pertinente à la phase active est** *toujours* **présente en mémoire par défaut** (pas besoin de la demander). **Le détail brut (via l'index) n'est récupéré qu'à la demande, quand le MJ-IA a un doute** — un peu comme un mécanisme de *skill* : la fiche résumé sert de rappel permanent, et si elle ne suffit pas, le MJ-IA va chercher l'échange original correspondant.
- **Q45.** `[x]` Une fiche entité est-elle propre à un scénario, ou persiste-t-elle au niveau de la campagne ?
  → **Décision : persiste au niveau de la campagne.** Un PNJ recroisé dans un scénario suivant de la même campagne garde sa mémoire (relation, historique).

## Roadmap V2 / V3 (contenu scénario)

- **Q33.** `[ ]` V2 "créer un scénario en s'inspirant de..." — l'inspiration est-elle un texte fourni par l'utilisateur, un autre scénario de la bibliothèque, ou une description libre ("façon Lovecraft") ?
- **Q34.** `[ ]` V3 génération de cartes via modèles en ligne — quel budget/fournisseur envisagé ?
