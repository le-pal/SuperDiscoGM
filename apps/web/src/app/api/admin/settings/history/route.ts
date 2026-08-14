import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { checkRole } from "@/server/authz";

// Historique des versions du prompt système global — pour un retour arrière, PATCH
// /api/admin/settings avec systemPrompt = le content d'une entrée de cet historique.
export async function GET() {
  const user = await checkRole("ADMIN");
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const versions = await prisma.promptVersion.findMany({
    where: { target: "GLOBAL_SYSTEM_PROMPT" },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json(versions);
}
