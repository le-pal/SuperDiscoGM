# Comparatif de modèles LLM — moteur de tour MJ-IA

Quatre modèles, un run complet chacun (20 tours scénarisés identiques, scénario Valjoyeux, tous
via OpenRouter), pour choisir le modèle par défaut de SuperDiscoGM. Protocole : `scripts/compare-model.mts`,
résultats bruts dans `test-campagne/<modèle>/data.json`, transcript lisible dans `transcript.html`.

Le critère prioritaire est la **fiabilité du tool-calling** — le moteur de jeu interdit toute
improvisation de règles en texte libre (dégâts, objets, transitions de scène passent
obligatoirement par des tool-calls structurés). Trois tool-calls étaient attendus sur des tours
dédiés : `apply_damage` (le personnage encaisse un coup), `add_item` (ramasse un objet),
`advance_phase` (conditions de sortie de scène explicitement réunies).

## Résultats

| Modèle | Score tool-calling | Durée totale | Tokens entrée | Tokens sortie | `apply_damage` | `add_item` | `advance_phase` |
|---|---|---|---|---|---|---|---|
| **google/gemini-3.1-flash-lite** | **2/3** | 66s (~3s/tour) | 296 405 | 30 606 | ✅ (×5, montant constant — sur-déclenchement probable) | ❌ | ✅ |
| deepseek/deepseek-v4-flash-latest | 2/3 | 250s (~12s/tour) | 200 504 | 33 322 | ✅ (×2, montants variés — plausible) | ❌ | ✅ |
| qwen/qwen3.6-flash | 1/3 | 273s (~14s/tour, le plus lent) | 175 895 | 53 473 | ❌ | ❌ | ✅ |
| anthropic/claude-haiku-4.5 | 1/3 | 105s (~5s/tour) | 257 342 | 19 276 | ✅ (×1) | ❌ | ❌ |

Aucun des 4 modèles n'a déclenché `add_item` malgré un tour dédié explicite ("Je ramasse une
torche...") — **root cause identifiée après coup, pas un vrai signal de fiabilité** : la fiche de
test possède déjà 3 torches dans son inventaire de départ (`scripts/compare-model.mts`, ligne 52),
donc "ramasser une torche" est raisonnablement lu par les 4 modèles comme de la mise en scène
(utiliser une torche déjà possédée) plutôt qu'une nouvelle acquisition méritant `add_item` — un
comportement plausible, pas forcément une erreur. Ce test spécifique ne permet donc AUCUNE
conclusion sur la fiabilité `add_item` des 4 modèles, ni dans un sens ni dans l'autre (à
distinguer du test séparé effectué plus tôt cette session avec un objet réellement nouveau et
narrativement significatif — "une amulette gravée abandonnée" trouvée dans des décombres — où
`gpt-4o-mini` avait correctement déclenché `add_item`). À refaire avec un objet sans ambiguïté
(inédit, absent de l'inventaire de départ) avant de tirer une vraie conclusion sur ce point précis.

## Verdict

**`google/gemini-3.1-flash-lite`** — le plus rapide des 4 (4x plus vite que Qwen/DeepSeek) et à
égalité sur le meilleur score de fiabilité (2/3, avec `deepseek-v4-flash-latest`). Le
sur-déclenchement de `apply_damage` (5 appels au même montant plutôt qu'un seul) est un point
d'attention réel — à vérifier si c'est un biais du modèle ou un effet du prompt système actuel qui
ne précise pas explicitement "n'applique les dégâts qu'une seule fois par événement" — mais reste
préférable à `claude-haiku-4.5` qui n'a jamais fait avancer la phase de toute la simulation malgré
des conditions de sortie énoncées explicitement dans le tour dédié, ce qui est plus grave qu'un
sur-déclenchement (un joueur bloqué dans une scène qui ne progresse jamais est pire qu'un
personnage qui perd un peu trop de PV).

`deepseek-v4-flash-latest` reste une alternative valable (même score) si la latence ~4x plus
élevée n'est pas un problème pour l'usage visé (table asynchrone plutôt que temps réel serré) —
et à noter que son comportement de raisonnement semble variable d'un run à l'autre (33k tokens de
sortie ici contre un pic à 16 677 tokens pour un seul appel lors d'un test précédent cette même
session), ce qui le rend moins prévisible en coût que Gemini.

`qwen/qwen3.6-flash` et `anthropic/claude-haiku-4.5` sont écartés pour un usage par défaut sur ce
produit : le premier n'a déclenché aucun tool-call de fiche sur toute la simulation, le second n'a
jamais fait progresser la scène.

**Recommandation : `google/gemini-3.1-flash-lite` comme modèle par défaut**, avec un ajustement du
prompt système pour clarifier "un seul appel `apply_damage` par événement de dégâts" avant de
considérer le sujet clos.
