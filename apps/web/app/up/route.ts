import { NextResponse } from "next/server";

/** Probe Railway/Render: la raíz `/` redirige; aquí siempre 200 sin auth. */
export function GET() {
  return NextResponse.json({ ok: true, service: "delta-space-web" }, { status: 200 });
}
