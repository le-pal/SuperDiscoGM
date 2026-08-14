import { NextResponse } from "next/server";
import { requireUser } from "@/server/authz";
import { getDashboardData } from "@/server/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  const data = await getDashboardData(user);
  return NextResponse.json(data);
}
