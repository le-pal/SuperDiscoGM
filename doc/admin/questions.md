# Questions — Admin

Retour à [l'index](../index.md). Statut : `[ ]` ouverte · `[x]` tranchée (voir [spec.md](spec.md)).

Aucune question ouverte pour ce lot à date — toutes tranchées. Historique conservé pour traçabilité.

- **Q01.** `[x]` "Maître du Jeu Virtuel" — le MJ est-il **toujours** une IA, ou un humain peut-il aussi endosser le rôle de MJ ?
  → **Décision : le MJ est toujours une IA.** "Mettre des images/contenu/mise en forme" est donc une action du MJ-IA lui-même (déclenchement et source à préciser — `[Q28]`, voir [partie/questions.md](../partie/questions.md)).
- **Q02.** `[x]` Un seul système de jeu par instance, ou plusieurs tables/parties indépendantes en parallèle ?
  → **Décision : multi-tenant dès la V1.** Plusieurs parties tournent en parallèle sur la même instance, chacune avec ses joueurs/campagne/scénario propres.
- **Q03.** `[x]` Qui paie/porte le coût des appels au modèle (API) ?
  → **Décision : budget/clé API globale gérée par l'Admin.** Cohérent avec "l'Admin choisit les modèles".
- **Q04.** `[x]` La hiérarchie des rôles implique-t-elle un héritage complet des droits vers le bas ?
  → **Décision : héritage strict.** Chaque rôle a tous les droits des rôles en dessous de lui, plus les siens propres.
- **Q05.** `[x]` Qui peut créer une campagne ? Un scénario ?
  → **Décision : Super utilisateur** (l'Admin peut aussi, par héritage — `[Q04]`).
- **Q06.** `[x]` Une persona MJ est-elle liée à une campagne, un scénario, ou réutilisable globalement ?
  → **Décision : bibliothèque globale réutilisable, avec possibilité de surcharge (override) au niveau campagne et au niveau scénario.** Résolution par spécificité : scénario > campagne > persona globale par défaut.
- **Q07.** `[x]` Le Spectateur peut-il écrire dans le chat ?
  → **Décision : lecture seule stricte.**
- **Q08.** `[x]` Un Utilisateur peut-il changer de rôle en cours de partie ?
  → **Décision : bascule libre Utilisateur ↔ Spectateur**, la fiche de personnage est conservée au retour.
- **Q09.** `[x]` Le prompt système est-il global ou par campagne/scénario ?
  → **Décision : un seul prompt système global (Admin)**, sur lequel vient se composer la persona MJ (`[Q06]`). Résout aussi `[Q24]`.
- **Q24.** `[x]` Le prompt système (Admin) est-il combiné automatiquement avec la persona du MJ (Super utilisateur) ?
  → **Décision : composition en couches.** Le prompt système global sert de socle, la persona MJ vient s'ajouter par-dessus, jamais le remplacer.
