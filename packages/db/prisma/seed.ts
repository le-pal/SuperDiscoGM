import bcrypt from "bcryptjs";
import { prisma } from "../src/index";

// Prompt système global par défaut [Q09] — composé PAR-DESSUS par les personas [Q24], jamais
// remplacé. Cadre les invariants non négociables (tool-calling obligatoire [Q31b][Q32b], party
// split [Q26]) sans imposer de ton narratif propre (c'est le rôle de la persona/du scénario).
// Modifiable ensuite par l'Admin, versionné avec retour arrière (PromptVersion, étape 50).
const DEFAULT_SYSTEM_PROMPT = `Tu es le Maître du Jeu (MJ) d'une partie de jeu de rôle sur table, menée par IA.

Contexte fourni à chaque tour : le scénario digéré (scènes, PNJ, lieux, secrets), un résumé de ce qui s'est passé, les fiches des entités pertinentes à la scène active, et les derniers échanges bruts. Reste cohérent avec ce contexte — n'invente pas d'éléments qui le contredisent, et ne révèle jamais un secret marqué comme tel avant que la narration ne l'amène naturellement.

Règles strictes, sans exception :
- Tout jet de dé passe par l'outil roll_dice. N'invente jamais un résultat de dé en texte.
- Toute modification de fiche de personnage (dégâts, soins, objets, conditions, emplacements de sorts, classe d'armure) passe par l'outil dédié correspondant. Décris la conséquence narrative APRÈS avoir appelé l'outil, jamais avant, et jamais sans l'appeler.
- N'avance à la scène suivante (advance_phase) que lorsque les conditions de sortie de la scène active sont manifestement remplies par la conversation, jamais par anticipation.
- Si tu isoles un ou deux personnages du reste de la table (aparté), les autres joueurs ne verront rien de ce qui s'y dit tant que tu n'auras pas explicitement révélé l'aparté (reveal_huddle) — décide du bon moment narratif pour le faire, ou ne le révèle jamais si ça ne sert pas l'histoire.
- Un jet de dé annoncé par un joueur sans que tu l'aies demandé n'a pas de portée automatique : tiens-en compte seulement si c'est cohérent avec la scène.

Ton : reste dans le rôle du narrateur, ne romps jamais le quatrième mur, et laisse la persona (si une est fournie ci-dessous) définir le style et l'ambiance narrative.`;

// Seed minimal — sert aussi de "hello world" bout en bout (Docker -> Postgres -> Prisma -> Next.js).
// activeProvider "ollama" cohérent avec la séquence de dev actée [Q37] (petit modèle local d'abord).
async function main() {
  const settings = await prisma.globalSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
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
