import bcrypt from "bcryptjs";
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

  // Compte Admin de bootstrap — sans lui, personne ne peut jamais se connecter ni inviter
  // qui que ce soit. À changer immédiatement après le premier login. Ne s'exécute que si
  // aucun Admin n'existe déjà (idempotent, ne clobber jamais un compte existant).
  const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!existingAdmin) {
    const email = process.env.ADMIN_EMAIL ?? "admin@superdiscogm.local";
    const password = process.env.ADMIN_PASSWORD ?? "changeme-immediately";
    const admin = await prisma.user.create({
      data: {
        email,
        name: "Admin",
        role: "ADMIN",
        passwordHash: await bcrypt.hash(password, 12),
        avatarColor: "#d64550",
      },
    });
    console.log(`Seed OK — Admin de bootstrap créé : ${admin.email} (change le mot de passe immédiatement)`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
