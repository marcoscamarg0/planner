import { NextResponse } from "next/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const { email, password, fullName } = await req.json();

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: "Nome, e-mail e senha são obrigatórios" }, { status: 400 });
    }

    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || appwriteConfig.endpoint;
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || appwriteConfig.projectId;

    // 1. Cria a conta no Appwrite
    const createRes = await fetch(`${endpoint}/account`, {
      method: "POST",
      headers: {
        "X-Appwrite-Project": projectId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: "unique()",
        email,
        password,
        name: fullName,
      }),
    });

    const createData = await createRes.json();

    if (!createRes.ok) {
      return NextResponse.json(
        { error: createData.message || "Erro ao criar conta no Appwrite" },
        { status: createRes.status }
      );
    }

    // 2. Cria a sessão automaticamente para logar
    const sessionRes = await fetch(`${endpoint}/account/sessions/email`, {
      method: "POST",
      headers: {
        "X-Appwrite-Project": projectId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const sessionData = await sessionRes.json();

    if (sessionRes.ok && sessionData.secret) {
      const cookieStore = await cookies();
      cookieStore.set("appwrite-session", sessionData.secret, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        expires: new Date(sessionData.expire),
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: createData.$id,
        email: createData.email,
        name: createData.name,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro ao cadastrar usuário" }, { status: 500 });
  }
}
