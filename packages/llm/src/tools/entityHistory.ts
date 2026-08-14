import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@superdiscogm/db";

// Récupération à la demande de l'historique brut d'une entité [Q43][Q44] — la fiche résumé
// (bloc 3 du contexte de tour, étape 30) suffit dans l'immense majorité des cas ; cet outil ne
// sert que pour les rares moments où le MJ-IA a besoin de relire l'échange exact qui a produit
// un fait précis. Jamais injecté par défaut, uniquement sur appel explicite du modèle [Q44].
//
// Contrairement aux autres outils du registre (context-free, singletons module-level), celui-ci
// doit être scopé à une campagne pour ne jamais laisser un MJ-IA remonter l'historique d'une
// autre table — d'où la forme factory plutôt qu'un export statique direct.
export function createLookupEntityHistoryTool(campaignId: string) {
  return tool({
    description:
      "Recherche l'historique détaillé d'une entité connue de la campagne (PNJ, lieu, faction, quête) : renvoie sa fiche résumé ainsi que les échanges bruts qui ont mené à son état actuel. À utiliser seulement si le résumé habituellement fourni en contexte ne suffit pas.",
    inputSchema: z.object({ entityName: z.string() }),
    execute: async ({ entityName }) => {
      const entities = await prisma.entityMemory.findMany({
        where: { campaignId, name: { contains: entityName, mode: "insensitive" } },
        include: { indexEntries: { orderBy: { createdAt: "asc" }, take: 5 } },
      });

      if (entities.length === 0) return { found: false, entities: [] };

      const results = await Promise.all(
        entities.map(async (entity) => {
          const excerpts = await Promise.all(
            entity.indexEntries.map(async (entry) => {
              const [from, to] = await Promise.all([
                prisma.message.findUnique({ where: { id: entry.fromMessageId } }),
                prisma.message.findUnique({ where: { id: entry.toMessageId } }),
              ]);
              if (!from || !to) return { messages: [] };

              const messages = await prisma.message.findMany({
                where: { partyId: entry.partyId, createdAt: { gte: from.createdAt, lte: to.createdAt } },
                orderBy: { createdAt: "asc" },
              });
              return { messages: messages.map((m) => ({ authorType: m.authorType, content: m.content })) };
            })
          );

          return { type: entity.type, name: entity.name, summary: entity.summary, excerpts };
        })
      );

      return { found: true, entities: results };
    },
  });
}
