# Spec — Scénario

Retour à [l'index](../index.md).

## Modèle Campagne / Scénario / Session

- **Campagne** : conteneur qui enchaîne plusieurs **scénarios** joués comme des chapitres. Le groupe de joueurs est **souple** (peut varier d'une session à l'autre). `[Q10]` `[Q12]`
- **Scénario** : contenu narratif jouable, découpé en phases après ingestion (voir §Pipeline). **Réutilisable dans plusieurs campagnes** (module indépendant, une fois digéré). `[Q10]`
- **Partie / Session** : instance de jeu au sein d'un scénario ; un scénario se joue sur **plusieurs sessions**. Lancée ou reprise par un Super utilisateur — la reprise recharge l'état exact où la partie s'est arrêtée (phase active, résumé, mémoire des entités). `[Q11]`

## Pipeline d'ingestion de scénario (V1)

Objectif : permettre à un scénario long d'être joué sans que le MJ-IA ne traîne un contexte trop lourd.

**Flux V1 :**

1. Le Super utilisateur fournit le scénario complet (tous les éléments dans un seul contenu). Format d'entrée : **texte collé ou upload de fichier (PDF/docx/markdown)** dès la V1. `[Q13]`
   - Images/cartes contenues dans un fichier uploadé : **ignorées en V1** (seul le texte est extrait), **mais le pipeline/modèle de données doit être conçu pour les accueillir plus tard** sans refonte (point d'extension prévu dès maintenant, pas de V-ultérieure surprise). `[Q13b]`
2. Une **commande d'analyse** est déclenchée. Elle :
   - annote le texte,
   - le répartit en **phases de jeu** distinctes,
   - produit une forme "digérée" consommable par le MJ-IA en cours de partie (plutôt que le texte brut intégral).
3. Exécution **asynchrone, avec notification** à la fin du traitement (le Super utilisateur n'attend pas bloqué, il est prévenu quand le scénario est prêt à être joué). `[Q14]`
4. **Pas de relecture/validation humaine obligatoire en V1** : le découpage automatique est utilisé tel quel, jouable immédiatement après l'analyse. *(Risque accepté sciemment — voir [index.md](../index.md) § Loups levés, point 5.)* `[Q15]`
5. Granularité d'une phase : **la scène**, avec **métadonnées structurées** (PNJ présents, lieu, conditions d'entrée/sortie, secrets à révéler) — pas seulement un résumé texte. Ces métadonnées alimentent directement la mémoire par entité (voir plus bas). `[Q16]`
6. Détection de la transition entre phases pendant la partie : **automatique par le MJ-IA**, qui compare la conversation en cours aux conditions de sortie de la phase active. `[Q17]`
7. Le scénario digéré est **modifiable après coup, avec ré-analyse** ; une session en cours continue avec l'ancien découpage jusqu'à sa fin (pas de casse en direct). `[Q18]`

## Gestion du contexte (mémoire de session)

Chaque tour envoyé au modèle est assemblé à partir de blocs distincts, maintenus séparément :

| Bloc | Rôle | Maintenu par |
|---|---|---|
| Scénario global (digéré) | Référence stable issue du pipeline d'ingestion | Pipeline d'analyse, modifiable avec ré-analyse (`[Q18]`) |
| Résumé de la partie | Ce qui s'est passé avant, condensé | Agent dédié, mis à jour après chaque tour/échange significatif (`[Q20]`) |
| Actions importantes des joueurs (fichier de session) | Journal structuré des décisions/événements clés | Agent dédié, extraction automatique continue (`[Q21]`) — schéma de données `TBD [Q21b]` |
| Prompt système + persona MJ | Cadrage du comportement du MJ | Voir [admin/spec.md](../admin/spec.md) |
| Dernières conversations | Fenêtre glissante des derniers échanges bruts | Automatique — **premier bloc tronqué** en cas de dépassement du budget de contexte |

- **Ordre de troncature si dépassement du budget de contexte : dernières conversations d'abord.** Scénario digéré, résumé, fiches entités pertinentes et prompt système+persona restent prioritaires. `[Q19]`
- **Hiérarchie de résumés à 3 niveaux dès la conception** : résumé de session → consolidé en résumé d'arc/scénario → consolidé en résumé de campagne. `[Q22]`
- **Ce qui persiste entre scénarios d'une même campagne** : la mémoire par entité (PNJ, lieux, factions, quêtes) survit au niveau de la campagne et traverse les scénarios. **Ce qui reste local au scénario** : son découpage en phases et ses secrets propres (le scénario reste un module indépendant, réutilisable tel quel dans d'autres campagnes). `[Q23]` `[Q45]`

*Le maintien du résumé et du fichier d'actions importantes est porté par un agent dédié, sur le modèle d'une mémoire de session façon Claude Code.*

### Mémoire indexée par entité

En complément du résumé linéaire, le "fichier d'actions importantes" est structuré **par entité** — **PNJ, lieux, factions et quêtes actives** (`[Q41]`) :

- Chaque entité a une **fiche mémoire** : résumé court et à jour de la relation/l'état, + un **index de pointeurs** vers les échanges bruts d'origine, groupés **par échange/scène** (`[Q43]`).
- L'écriture dans une fiche entité est faite par **extraction automatique d'un agent dédié** (le même que pour le résumé et le journal d'actions, `[Q20]`/`[Q21]`), pas par un appel d'outil explicite du MJ-IA. `[Q42]`
- **Modèle de récupération en deux temps** (`[Q44]`) :
  1. La **fiche résumé courte** de chaque entité pertinente à la phase/scène active est **toujours injectée par défaut** dans le contexte du tour — pas besoin de la demander.
  2. Le **détail brut** (via l'index) n'est récupéré **qu'à la demande**, quand le MJ-IA a un doute — mécanisme similaire à un chargement de *skill* : la fiche résumé sert de rappel permanent, et si elle ne suffit pas, le MJ-IA va chercher l'échange original correspondant.

**Portée d'une fiche entité : persiste au niveau de la campagne** (pas propre à un seul scénario) — un PNJ recroisé dans un scénario suivant de la même campagne garde sa mémoire. `[Q45]`
