import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { checkRole } from "@/server/authz";
import { extractText } from "@/server/scenarioFiles";

// Upload PDF/docx/markdown [Q13]. Stocké en base (Bytes) pour l'instant, pas de stockage objet
// en V1 [Q13b] — voir doc/technique/spec.md pour le point de bascule documenté. Le texte extrait
// (images/cartes ignorées en V1) est fusionné dans Scenario.rawContent [Q13b], étape 20 du PLAN.md.
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
  const mimeType = file.type || "application/octet-stream";

  const [scenarioFile, extractedText] = await Promise.all([
    prisma.scenarioFile.create({
      data: { scenarioId, filename: file.name, mimeType, data },
      select: { id: true, filename: true, mimeType: true, uploadedAt: true }, // jamais renvoyer data
    }),
    extractText(data, mimeType, file.name).catch(() => ""), // un fichier illisible ne doit pas bloquer l'upload
  ]);

  if (extractedText.trim().length > 0) {
    const merged = scenario.rawContent ? `${scenario.rawContent}\n\n${extractedText}` : extractedText;
    await prisma.scenario.update({ where: { id: scenarioId }, data: { rawContent: merged } });
  }

  return NextResponse.json(scenarioFile, { status: 201 });
}
