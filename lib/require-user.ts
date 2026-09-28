import { auth } from "@/auth";

export async function requireUserId() {
  return (await auth())?.user?.id ?? null;
}
