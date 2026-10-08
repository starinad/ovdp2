import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireUserId } from "@/lib/require-user";

export const runtime = "nodejs";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { rows } = await getPool().query("SELECT config FROM user_configs WHERE user_id = $1", [userId]);
    const config = rows[0]?.config ?? {};
    const amount = Number(config.monthlyInvestment);
    return NextResponse.json({
      theme: config.theme === "light" ? "light" : "dark",
      monthlyInvestment: Number.isFinite(amount) && amount >= 0 ? amount : 0,
      monthlyInvestmentCurrency: config.monthlyInvestmentCurrency === "USD" ? "USD" : "UAH",
    });
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
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid preferences" }, { status: 400 });
  const preferences: Record<string, string | number> = {};
  if ("theme" in body) {
    if (body.theme !== "dark" && body.theme !== "light") return NextResponse.json({ error: "Theme must be dark or light" }, { status: 400 });
    preferences.theme = body.theme;
  }
  if ("monthlyInvestment" in body || "monthlyInvestmentCurrency" in body) {
    const amount = (body as Record<string, unknown>).monthlyInvestment;
    const currency = (body as Record<string, unknown>).monthlyInvestmentCurrency;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || (currency !== "UAH" && currency !== "USD")) {
      return NextResponse.json({ error: "Monthly investment must be a non-negative number with UAH or USD currency" }, { status: 400 });
    }
    preferences.monthlyInvestment = amount;
    preferences.monthlyInvestmentCurrency = currency;
  }
  if (!Object.keys(preferences).length) return NextResponse.json({ error: "No valid preferences provided" }, { status: 400 });
  try {
    await getPool().query(
      `INSERT INTO user_configs (user_id, config) VALUES ($1, $2::jsonb)
       ON CONFLICT (user_id) DO UPDATE SET config = user_configs.config || EXCLUDED.config`,
      [userId, JSON.stringify(preferences)],
    );
    return NextResponse.json(preferences);
  } catch (error) {
    console.error("Could not save user config", error);
    return NextResponse.json({ error: "Could not save preferences" }, { status: 503 });
  }
}
