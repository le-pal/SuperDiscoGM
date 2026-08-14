import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { requireUser } from "@/server/authz";

// Montée de niveau — reste du ressort du joueur [Q31], pas un tool-call MJ-IA (contrairement
// aux dégâts/soins/objets). hpGain : le joueur (ou son livre de règles côté client) calcule le
// gain de PV, l'API se contente de l'appliquer et de journaliser pour la traçabilité.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: sheetId } = await params;

  const sheet = await prisma.characterSheet.findUnique({ where: { id: sheetId } });
  if (!sheet) return NextResponse.json({ error: "Fiche introuvable." }, { status: 404 });
  if (sheet.userId !== user.id) {
    return NextResponse.json({ error: "Seul le joueur propriétaire peut monter son personnage de niveau." }, { status: 403 });
  }

  const { hpGain } = await request.json();
  if (typeof hpGain !== "number" || hpGain <= 0) {
    return NextResponse.json({ error: "hpGain (> 0) requis." }, { status: 400 });
  }

  const hpMax = sheet.hpMax + hpGain;
  const updated = await prisma.characterSheet.update({
    where: { id: sheetId },
    data: { level: sheet.level + 1, hpMax, hp: hpMax }, // pleins PV à la montée de niveau, convention V1
  });

  await prisma.characterSheetLog.create({
    data: {
      characterSheetId: sheetId,
      toolName: "level_up",
      argsJson: { hpGain },
      resultJson: { level: updated.level, hpMax: updated.hpMax },
    },
  });

  return NextResponse.json(updated);
}
