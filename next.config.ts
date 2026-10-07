import { execSync } from "node:child_process";
import type { NextConfig } from "next";

let appVersion = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
try {
  appVersion ??= execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  if (execSync("git status --porcelain", { encoding: "utf8" }).trim()) appVersion += "-dirty";
} catch {
  appVersion ??= "unknown";
}

const nextConfig: NextConfig = { env: { NEXT_PUBLIC_APP_VERSION: appVersion } };
export default nextConfig;
