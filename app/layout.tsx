import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OBLIG | Bond portfolio",
  description: "A clear view of your Ukrainian government bond portfolio.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
