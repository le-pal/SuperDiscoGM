import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { requireUser } from "@/server/authz";

// Bloc-notes personnel, privé [Q46] : jamais lu par le MJ-IA (assembleTurnContext, étape 30, ne
// l'interroge jamais) ni par les autres joueurs — cette route ne renvoie/n'accepte que la note
// de l'utilisateur courant, jamais un userId arbitraire. Portée campagne (pas scénario), déjà
// tranchée par le modèle de données [Q46b] (PlayerNote.campaignId, pas scenarioId).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: campaignId } = await params;

  const note = await prisma.playerNote.findUnique({
    where: { userId_campaignId: { userId: user.id, campaignId } },
  });

  return NextResponse.json({ content: note?.content ?? "" });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: campaignId } = await params;

  const { content } = await request.json();
  if (typeof content !== "string") {
    return NextResponse.json({ error: "content (string) requis." }, { status: 400 });
  }

  const note = await prisma.playerNote.upsert({
    where: { userId_campaignId: { userId: user.id, campaignId } },
    create: { userId: user.id, campaignId, content },
    update: { content },
  });

  return NextResponse.json({ content: note.content });
}
