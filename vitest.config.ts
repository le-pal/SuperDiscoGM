import { defineConfig } from "vitest/config";

// Config minimale — un seul runner pour tout le monorepo (workspaces npm), pas de setup par
// package tant qu'on n'en a pas besoin. Étape 47 du PLAN.md : tester en priorité les parties
// déterministes/risquées (dés, moteur de règles), pas une suite E2E lourde [Q40].
export default defineConfig({
  test: {
    include: ["apps/**/*.test.ts", "packages/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/generated/**"],
  },
});
