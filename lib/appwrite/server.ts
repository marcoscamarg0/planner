import { cookies } from "next/headers";
import { appwriteConfig } from "./config";
import { appwriteRest } from "./rest";

export async function createSessionClient() {
  const cookieStore = await cookies();
  const session = cookieStore.get("appwrite-session");

  return {
    session: session?.value || null,
    databases: appwriteRest,
  };
}

export async function createAdminClient() {
  return {
    databases: appwriteRest,
    config: appwriteConfig,
  };
}
