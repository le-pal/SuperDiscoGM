import { prisma, type PromptTarget } from "@superdiscogm/db";

/**
 * Journalise la valeur REMPLACÉE avant une modification de prompt (système global ou persona) —
 * permet un retour arrière : restaurer = réappliquer le contenu d'une version passée via le
 * chemin d'édition normal (PATCH), ce qui journalise à son tour la valeur courante (un "redo"
 * reste donc possible). La valeur courante n'est jamais dupliquée ici, elle vit dans
 * GlobalSettings.systemPrompt / Persona.systemPromptFragment.
 */
export async function snapshotPromptVersion(params: {
  target: PromptTarget;
  personaId?: string | null;
  previousContent: string;
  createdById: string;
}) {
  const { target, personaId, previousContent, createdById } = params;
  await prisma.promptVersion.create({
    data: { target, personaId: personaId ?? null, content: previousContent, createdById },
  });
}
