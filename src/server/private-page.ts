import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";

export async function requirePrivatePage(path: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  return user;
}
