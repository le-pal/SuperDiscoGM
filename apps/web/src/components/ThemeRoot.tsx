"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

// 4 thèmes visuels par défaut (demande explicite de Philippe — le thème sombre unique
// "faisait tristounet"). Préférence CLIENT (localStorage), pas de champ DB : évite toute
// migration de schéma pour un simple choix d'affichage, et s'applique instantanément sans
// aller-retour serveur. "sobre" = thème actuel, conservé tel quel comme choix par défaut.
export const THEMES = ["sobre", "disco", "psychedelique", "retro70"] as const;
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = "superdiscogm-theme";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "sobre";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return (THEMES as readonly string[]).includes(stored ?? "") ? (stored as Theme) : "sobre";
}

// Applique immédiatement à toutes les instances de .app-shell présentes dans le DOM (il ne peut
// y en avoir qu'une par page, mais évite un couplage à un ref particulier depuis l'appelant).
export function setStoredTheme(theme: Theme): void {
  window.localStorage.setItem(STORAGE_KEY, theme);
  document.querySelectorAll(".app-shell").forEach((el) => el.setAttribute("data-theme", theme));
}

// Enveloppe le vrai conteneur .app-shell : le SSR ne connaît pas le thème choisi (localStorage
// n'existe pas côté serveur), donc l'attribut est posé après montage — un flash d'un frame sur
// le thème par défaut est acceptable ici, pas de script bloquant anti-FOUC pour rester simple.
export function ThemeRoot({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.setAttribute("data-theme", getStoredTheme());
  }, []);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
