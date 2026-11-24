import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { reportError } from "@/lib/diagnostics";

export const dynamic = "force-dynamic";

// Chequeo de salud para Railway, Vercel o un monitor externo. No expone datos.
export async function GET() {
  try {
    await getDb().$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    reportError("health.database", error);
    return NextResponse.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
