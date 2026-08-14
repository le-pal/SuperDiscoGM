import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { checkRole } from "@/server/authz";

// Prompt système global [Q09], fournisseur/modèle LLM actif [Q37], budget — réservé Admin.
export async function GET() {
  const user = await checkRole("ADMIN");
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const settings = await prisma.globalSettings.findUnique({ where: { id: 1 } });
  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  const user = await checkRole("ADMIN");
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const { systemPrompt, activeProvider, activeModel, monthlyBudget } = await request.json();

  const data: Record<string, unknown> = {};
  if (typeof systemPrompt === "string") data.systemPrompt = systemPrompt;
  if (typeof activeProvider === "string") data.activeProvider = activeProvider;
  if (typeof activeModel === "string") data.activeModel = activeModel;
  if (monthlyBudget === null || typeof monthlyBudget === "number") data.monthlyBudget = monthlyBudget;

  const settings = await prisma.globalSettings.update({ where: { id: 1 }, data });
  return NextResponse.json(settings);
}
