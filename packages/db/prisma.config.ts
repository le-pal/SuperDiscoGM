import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 : le CLI (migrate/seed) lit sa connexion ici, séparément de l'adapter runtime
// configuré dans src/index.ts (PrismaPg) — deux mécanismes distincts depuis la v7.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
