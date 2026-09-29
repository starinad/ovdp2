import type { Metadata } from "next";
import { connection } from "next/server";
import { auth } from "@/auth";
import { getPool } from "@/lib/db";
import "./globals.css";

export const metadata: Metadata = {
  title: "OBLIG | Bond portfolio",
  description: "A clear view of your Ukrainian government bond portfolio.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  let theme = "dark";
  try {
    const userId = (await auth())?.user?.id;
    if (userId) {
      const { rows } = await getPool().query("SELECT config->>'theme' AS theme FROM user_configs WHERE user_id = $1", [userId]);
      if (rows[0]?.theme === "light") theme = "light";
    }
  } catch (error) {
    console.error("Could not load user theme", error);
  }
  return <html lang="en" data-theme={theme}><body>{children}</body></html>;
}
