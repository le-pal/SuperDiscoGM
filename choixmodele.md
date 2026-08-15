# Choix du modèle LLM pour le moteur de tour (MJ-IA)

**Contexte.** Le moteur de tour (`packages/llm`, `turnEngine.ts`) appelle le LLM plusieurs fois par tour de jeu et attend des **appels d'outils fiables** (zod tool-calls : dégâts, inventaire, avancée de phase, etc.) — jamais de règle improvisée en texte libre. Trois modèles ont été testés en conditions réelles cette session, contre le vrai moteur de tour de l'app :

| Modèle testé | Résultat réel observé |
|---|---|
| `qwen3.5:9b` (Ollama local) | ~1/22 tool-calls spontanés déclenchés — quasi inutilisable |
| DeepSeek V4 Flash Latest (OpenRouter) | Tool-calls corrects quand déclenchés, mais **très coûteux en tokens cachés de raisonnement** (16 677 tokens de sortie pour une seule extraction d'entité) |
| GPT-4o-mini (OpenRouter) | 3/3 tool-calls corrects sur une sonde ciblée (dégâts, objet, avancée de phase), tokens propres (~170-205 sortie/tour) |

Cette recherche (2026-08-15) complète ces mesures empiriques avec des benchmarks publiés et des prix à jour, car mes connaissances internes de modèles datent d'environ 8 mois. Sources en bas de page.

## Méthodologie

- Recherche web (3 requêtes) : Berkeley Function-Calling Leaderboard (BFCL v3, dernière mise à jour juillet 2026), retours terrain sur le tool-calling en production, statut de GPT-4o-mini.
- Prix et IDs de modèles vérifiés en direct contre l'API publique OpenRouter (`GET /api/v1/models`), pas de valeurs devinées.
- Priorité donnée à : fiabilité du tool-calling (BFCL + retours terrain) **et** coût par token, car l'app fait de nombreux petits appels d'outils par session — un modèle qui gonfle silencieusement les tokens de raisonnement (cf. DeepSeek V4 Flash ci-dessus) est disqualifiant même s'il est nominalement "gratuit".

## Top 5

### 1. Gemini 3.1 Flash Lite — `google/gemini-3.1-flash-lite`
- **Prix (OpenRouter) :** $0.25 / $1.50 par million de tokens (entrée/sortie) — $0.25/$1.50, contexte 1M tokens.
- **Pourquoi :** classé 3e sur BFCL v3 (76.5%, juste derrière GLM 4.5 76.7% et Claude Opus 4.7 76.6%) — donc quasiment au niveau de modèles bien plus chers sur le function-calling pur, benchmark exécutable (AST) et pas une vibe check. C'est un modèle "stable" (pas preview), avec fenêtre de contexte confortable (1M) pour la mémoire d'entités et les résumés de scénario. Meilleur ratio fiabilité/prix trouvé dans cette recherche.
- **Risque :** app actuelle ne supporte pas encore le provider Google en direct (seulement anthropic/openai/ollama/openrouter) — mais OpenRouter suffit, aucun code supplémentaire requis.

### 2. GPT-4o-mini — `openai/gpt-4o-mini`
- **Prix :** $0.15 / $0.60 par million de tokens, contexte 128K.
- **Pourquoi :** c'est le choix provisoire de cette session, et il tient la route : un retour de production cité dans la recherche (Pristren, juin 2026) le décrit spécifiquement comme "le plus fiable pour les workflows structurés qui appellent des API externes... sans dériver" — exactement le besoin ici. Confirmé aussi par notre propre sonde (3/3, tokens propres).
- **Risque à noter :** GPT-4o-mini a été retiré de la page de pricing principale d'OpenAI en 2026 (toujours disponible via API, mais officieusement legacy). OpenAI pousse vers GPT-5 Mini / GPT-4.1 Mini pour les nouveaux projets. Pas urgent de migrer, mais à surveiller — un retrait total de l'API romprait le moteur de tour sans préavis autre qu'une dépréciation.

### 3. GPT-5 Mini — `openai/gpt-5-mini`
- **Prix :** $0.25 / $2.00 par million de tokens, contexte 400K.
- **Pourquoi :** successeur direct dans la gamme OpenAI, generation plus récente avec un tool-calling plus travaillé (structured outputs strict natif). Coût d'entrée proche de GPT-4o-mini, sortie un peu plus chère, mais évite le risque de dépréciation ci-dessus. Bon candidat pour un test A/B direct contre GPT-4o-mini sur le harnais de simulation existant (`.claude/skills/simulate-quest`).
- **Non testé en direct cette session** — recommandé comme prochaine étape de validation avant adoption définitive.

### 4. GLM 4.5 Air — `z-ai/glm-4.5-air`
- **Prix :** $0.13 / $0.85 par million de tokens, contexte 131K.
- **Pourquoi :** la version complète GLM 4.5 est **numéro 1 sur BFCL v3** (76.7%, devant Claude Opus 4.7 et Gemini 3.1 Flash Lite). La variante "Air" (moins chère, probablement légèrement en retrait sur le score brut mais même famille d'entraînement au tool-calling) offre un point bas de coût avec une lignée de benchmark très solide. Bon candidat "outsider" à tester si le budget doit encore baisser.
- **Risque :** fournisseur (Zhipu/Z.ai) moins établi en production occidentale que Google/OpenAI/Anthropic ; pas de retour terrain trouvé dans cette recherche pour un cas d'usage comparable au nôtre.

### 5. Claude Haiku 4.5 — `anthropic/claude-haiku-4.5` (ou provider `anthropic` natif de l'app)
- **Prix :** $1.00 / $5.00 par million de tokens, contexte 200K — nettement plus cher que les 4 autres.
- **Pourquoi il reste dans le top 5 :** la recherche terrain note qu'Anthropic est "particulièrement discipliné sur les tool-calls" dans la famille Opus/Sonnet ; Haiku 4.5 en hérite. Surtout, `packages/llm` supporte déjà `anthropic` comme provider de premier rang (pas besoin de passer par OpenRouter, donc pas de couche d'indirection ni de marge OpenRouter) — intéressant si la fiabilité prime sur le coût pour les scènes critiques (combats, décisions à fort enjeu narratif).
- **Risque :** 4 à 8x plus cher que les autres candidats du top 5 — à réserver à un usage ciblé plutôt qu'à tous les tours, sauf si le budget le permet.

## Verdict sur GPT-4o-mini

**Le choix provisoire est confirmé, avec une nuance.** La recherche confirme que GPT-4o-mini est un bon choix pour ce cas d'usage précis (tool-calling fiable, pas de dérive, coût bas) — un retour de production indépendant le classe explicitement en tête pour les workflows structurés à appels d'API. Ce n'est **pas contredit** par les benchmarks BFCL non plus (GPT-4o-mini n'y figure pas nommément dans les résultats trouvés, mais la famille GPT-4o est reconnue fiable).

La nuance : GPT-4o-mini est maintenant un modèle "de transition" chez OpenAI (retiré de la page de pricing publique, non mis en avant pour les nouveaux projets). Rien n'indique qu'il va disparaître à court terme, mais **Gemini 3.1 Flash Lite (choix n°1)** offre un meilleur score de benchmark exécutable (BFCL), un prix comparable, une fenêtre de contexte 8x plus grande, et est un modèle activement poussé par son fournisseur plutôt qu'en fin de vie. Recommandation : garder GPT-4o-mini en fonctionnement (il marche, il est testé, il est bon marché), mais planifier un test A/B contre Gemini 3.1 Flash Lite avec le harnais `simulate-quest` existant avant de le considérer comme le choix définitif V1.

## Mise en garde additionnelle (issue des tests de cette session)

Le score BFCL ne suffit pas à lui seul : `qwen3.5:9b` figure dans le catalogue OpenRouter à un prix très bas ($0.10/$0.15) et est présenté dans plusieurs articles comme "le meilleur modèle local pour le tool-calling" — pourtant nos tests réels contre le vrai moteur de tour ont montré un taux d'échec quasi total (~1/22). De même, DeepSeek V4 Flash est annoncé "quasi gratuit" par plusieurs blogs mais notre test réel a montré un surcoût de raisonnement caché massif (16 677 tokens de sortie pour un seul appel). **Conclusion méthodologique : ne jamais adopter un modèle sur la seule base d'un benchmark ou d'un article — toujours valider avec le harnais de simulation réel de l'app avant un changement de `GlobalSettings.activeProvider`/`activeModel`.**

## Sources

- [BFCL v3 Leaderboard 2026 - Compare AI Model Scores](https://pricepertoken.com/leaderboards/benchmark/bfcl-v3)
- [Berkeley Function Calling Leaderboard (BFCL) V4 - Gorilla](https://gorilla.cs.berkeley.edu/leaderboard.html)
- [BFCL Leaderboard - llm-stats.com](https://llm-stats.com/benchmarks/bfcl)
- [Best LLMs for AI Agents: Cost vs Intelligence Tradeoffs | DeployBase](https://deploybase.ai/articles/best-llm-for-ai-agents)
- [Best Local Models for Tool Calling in 2026: Benchmarks | PromptQuorum](https://www.promptquorum.com/power-local-llm/best-local-models-tool-calling-2026)
- [ChatGPT vs Claude vs Gemini vs DeepSeek [2026] - LLM Comparison Guide - Pristren](https://pristren.com/blog/llm-comparison-guide-2026/)
- [GPT-4o-mini vs GPT-5 - Pricing & Benchmark Comparison 2026 - pricepertoken](https://pricepertoken.com/compare/openai-gpt-4o-mini-vs-openai-gpt-5)
- [GPT-5.4 Mini vs GPT-4o Mini (2026) - SitePoint](https://www.sitepoint.com/gpt-5-4-mini-vs-gpt-4o-mini-comparison-2026/)
- [Gemini 3.1 Flash Lite - API Pricing & Providers - OpenRouter](https://openrouter.ai/google/gemini-3.1-flash-lite)
- [Gemini 3.1 Flash-Lite API Pricing (May 2026) - devtk.ai](https://devtk.ai/en/models/gemini-3-1-flash-lite/)
- [OpenRouter public models API](https://openrouter.ai/api/v1/models) (requête directe, prix/IDs vérifiés le 2026-08-15)
