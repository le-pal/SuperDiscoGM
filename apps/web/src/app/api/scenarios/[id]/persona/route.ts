import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { checkRole } from "@/server/authz";

// Surcharge de persona au niveau scénario (priorité max, [Q06]) — personaId: null retire la surcharge.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkRole("SUPER_USER");
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const { id: scenarioId } = await params;
  const { personaId } = await request.json();
  if (personaId !== null && typeof personaId !== "string") {
    return NextResponse.json({ error: "personaId doit être une chaîne ou null." }, { status: 400 });
  }

  const scenario = await prisma.scenario.update({ where: { id: scenarioId }, data: { personaId } });
  return NextResponse.json(scenario);
}
