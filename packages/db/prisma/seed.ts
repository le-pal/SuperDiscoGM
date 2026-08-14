import { prisma } from "../src/index";

// Seed minimal — sert aussi de "hello world" bout en bout (Docker -> Postgres -> Prisma -> Next.js).
// activeProvider "ollama" cohérent avec la séquence de dev actée [Q37] (petit modèle local d'abord).
async function main() {
  const settings = await prisma.globalSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      systemPrompt: "Tu es le Maître du Jeu. (placeholder — voir doc/admin/spec.md)",
      activeProvider: "ollama",
      activeModel: "qwen3.5:9b",
    },
    update: {},
  });

  console.log("Seed OK — GlobalSettings:", settings);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
