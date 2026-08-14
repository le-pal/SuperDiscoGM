// Ambiance dynamique par lieu (étape 40, hypothèse V1) — la CSS (globals.css) ne définit que 3
// palettes (`grotte`, `jungle`, `ville`, cf maquette/ecran-partie.html), alors que
// `Phase.locationTag` est un texte libre produit par le pipeline d'ingestion (étape 20). Faute
// d'un tag d'ambiance dédié dans le modèle de données, on classe par mots-clés simples plutôt
// que d'ajouter un champ IA-généré supplémentaire non spécifié par la doc — "ville" est le
// repli par défaut. À affiner (ou remplacer par une vraie classification) si les libellés de
// lieux réels s'avèrent trop variés pour ces heuristiques.
export type Ambiance = "grotte" | "jungle" | "ville";

const GROTTE_KEYWORDS = ["grotte", "caverne", "souterrain", "mine", "tunnel", "crypte", "catacombe"];
const JUNGLE_KEYWORDS = ["jungle", "forêt", "foret", "bois", "marais", "marécage", "marecage"];

export function inferAmbiance(locationTag: string | null | undefined): Ambiance {
  const tag = (locationTag ?? "").toLowerCase();
  if (GROTTE_KEYWORDS.some((k) => tag.includes(k))) return "grotte";
  if (JUNGLE_KEYWORDS.some((k) => tag.includes(k))) return "jungle";
  return "ville";
}
