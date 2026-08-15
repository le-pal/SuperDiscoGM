"use client";

import { useEffect, useState } from "react";
import { THEMES, getStoredTheme, setStoredTheme, type Theme } from "@/components/ThemeRoot";

const THEME_LABELS: Record<Theme, string> = {
  sobre: "Sobre",
  disco: "Disco",
  psychedelique: "Psychédélique",
  retro70: "Rétro 70s",
};

const THEME_PREVIEW: Record<Theme, string> = {
  sobre: "#e0a955",
  disco: "#ff2fb0",
  psychedelique: "#ff6b1a",
  retro70: "#da9100",
};

// 4 thèmes visuels par défaut — choix client (localStorage, cf ThemeRoot.tsx), appliqué
// instantanément à toute l'app dès le clic, pas de rechargement de page nécessaire.
export function ThemeSelector() {
  const [theme, setTheme] = useState<Theme>("sobre");

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  function pick(next: Theme) {
    setTheme(next);
    setStoredTheme(next);
  }

  return (
    <div className="flex gap-8 wrap">
      {THEMES.map((t) => (
        <button
          key={t}
          type="button"
          className={`btn small ${theme === t ? "primary" : "ghost"}`}
          onClick={() => pick(t)}
        >
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: THEME_PREVIEW[t],
              marginRight: 6,
            }}
          />
          {THEME_LABELS[t]}
        </button>
      ))}
    </div>
  );
}
