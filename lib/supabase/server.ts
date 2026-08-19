import { cookies } from "next/headers";
import { createAppwriteClient } from "@/lib/appwrite/adapter";

export async function createClient() {
  const cookieStore = await cookies();
  const session = cookieStore.get("appwrite-session");
  return createAppwriteClient(session?.value || null);
}

export async function createServiceClient() {
  return createAppwriteClient(null);
}
