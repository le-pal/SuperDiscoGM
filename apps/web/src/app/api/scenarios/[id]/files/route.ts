import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { checkRole } from "@/server/authz";

// Upload PDF/docx/markdown [Q13]. Stocké en base (Bytes) pour l'instant, pas de stockage objet
// en V1 [Q13b] — voir doc/technique/spec.md pour le point de bascule documenté. L'extraction de
// texte (pdf-parse/mammoth) est une étape séparée (étape 20 du PLAN.md), pas faite ici.
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 Mo, garde-fou raisonnable pour un scénario texte

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkRole("SUPER_USER");
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const { id: scenarioId } = await params;
  const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId } });
  if (!scenario) return NextResponse.json({ error: "Scénario introuvable." }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier requis (champ 'file')." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)." }, { status: 413 });
  }

  const data = Buffer.from(await file.arrayBuffer());
  const scenarioFile = await prisma.scenarioFile.create({
    data: {
      scenarioId,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      data,
    },
    select: { id: true, filename: true, mimeType: true, uploadedAt: true }, // jamais renvoyer data
  });

  return NextResponse.json(scenarioFile, { status: 201 });
}
