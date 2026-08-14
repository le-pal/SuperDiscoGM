# Spec — Admin

Retour à [l'index](../index.md).

## Rôles & permissions

Hiérarchie à héritage strict : chaque rôle a tous les droits des rôles en dessous, plus les siens propres. `[Q04]`

| Rôle | Droits propres | Hérite de |
|---|---|---|
| **Admin** | Choisit les modèles LLM, gère les utilisateurs, gère le prompt système | Super utilisateur, Utilisateur, Spectateur |
| **Super utilisateur** | Lance/reprend une partie, ajoute une persona à un MJ, **crée des campagnes et des scénarios** | Utilisateur, Spectateur |
| **Utilisateur** | Rejoint une partie | Spectateur |
| **Spectateur** | Rejoint une partie en observateur, **lecture seule stricte** (pas d'écriture dans le chat) | — |

- Création de campagne : **Super utilisateur** (Admin par héritage). `[Q05]`
- Création de scénario : **Super utilisateur** (Admin par héritage). `[Q05]`
- Un Utilisateur peut basculer librement entre Utilisateur ↔ Spectateur en cours de partie (fiche de personnage conservée au retour). `[Q08]`
- Le Spectateur est en lecture seule stricte, aucune écriture dans le chat de partie. `[Q07]`

## Multi-tenant & budget

- Multi-tenant dès la V1 : plusieurs parties/tables indépendantes tournent en parallèle sur la même instance. `[Q02]`
- Coût des appels API : budget/clé globale gérée par l'Admin. `[Q03]`

## Persona MJ & prompt système

- **Prompt système** : un seul prompt système **global**, géré par l'Admin (garde-fous, règles générales du MJ-IA). `[Q09]`
- **Persona MJ** : bibliothèque **globale** de personas réutilisables (par genre/type de jeu), gérée par le Super utilisateur, avec **surcharge possible au niveau campagne et au niveau scénario**. Résolution par spécificité : scénario > campagne > persona globale par défaut. `[Q06]`
- **Composition** : la persona vient toujours s'ajouter par-dessus le prompt système global — elle ne le remplace jamais. `[Q24]`
