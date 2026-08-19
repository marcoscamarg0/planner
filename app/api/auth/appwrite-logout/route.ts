import { NextResponse } from "next/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("appwrite-session");

    if (session?.value) {
      const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || appwriteConfig.endpoint;
      const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || appwriteConfig.projectId;

      // Invalida a sessão no servidor do Appwrite
      await fetch(`${endpoint}/account/sessions/current`, {
        method: "DELETE",
        headers: {
          "X-Appwrite-Project": projectId,
          "X-Appwrite-Session": session.value,
        },
      }).catch(() => {});
    }

    // Remove o cookie do navegador
    cookieStore.delete("appwrite-session");

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
