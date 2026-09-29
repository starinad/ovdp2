import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireUserId } from "@/lib/require-user";

export const runtime = "nodejs";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { rows } = await getPool().query("SELECT config->>'theme' AS theme FROM user_configs WHERE user_id = $1", [userId]);
    return NextResponse.json({ theme: rows[0]?.theme === "light" ? "light" : "dark" });
  } catch (error) {
    console.error("Could not load user config", error);
    return NextResponse.json({ error: "Could not load preferences" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (!body || typeof body !== "object" || !("theme" in body) || !["dark", "light"].includes(String(body.theme))) {
    return NextResponse.json({ error: "Theme must be dark or light" }, { status: 400 });
  }
  try {
    await getPool().query(
      `INSERT INTO user_configs (user_id, config) VALUES ($1, jsonb_build_object('theme', $2::text))
       ON CONFLICT (user_id) DO UPDATE SET config = user_configs.config || EXCLUDED.config`,
      [userId, body.theme],
    );
    return NextResponse.json({ theme: body.theme });
  } catch (error) {
    console.error("Could not save user config", error);
    return NextResponse.json({ error: "Could not save preferences" }, { status: 503 });
  }
}
