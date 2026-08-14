// Initiales déduites automatiquement du nom [Q50] — logique pure, réutilisée partout où un
// avatar est affiché (chat, dashboard, admin, profil), cf maquette/profil.html §"Où cet avatar apparaît".
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Bibliothèque de couleurs prédéfinie V1 [Q50] — mêmes valeurs que --p1..--p4 dans globals.css,
// plus quelques teintes additionnelles pour le sélecteur de profil (cf maquette/profil.html).
export const AVATAR_COLORS = [
  "#5b8dee",
  "#52b788",
  "#f4a259",
  "#9b6bce",
  "#d64550",
  "#3aafa9",
  "#c77dff",
  "#e0a955",
] as const;
