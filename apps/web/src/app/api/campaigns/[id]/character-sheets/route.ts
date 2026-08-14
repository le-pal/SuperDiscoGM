import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { checkRole } from "@/server/authz";

// Vue table de toutes les fiches d'une campagne — Super utilisateur (MJ humain qui supervise,
// Admin par héritage), pas un simple joueur qui ne doit voir que la sienne (voir route singulière).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkRole("SUPER_USER");
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const { id: campaignId } = await params;
  const sheets = await prisma.characterSheet.findMany({
    where: { campaignId },
    include: { user: { select: { id: true, name: true, avatarColor: true } } },
  });

  return NextResponse.json(sheets);
}
