import { NextResponse } from "next/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "E-mail e senha são obrigatórios" }, { status: 400 });
    }

    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || appwriteConfig.endpoint;
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || appwriteConfig.projectId;

    // 1. Cria a sessão de e-mail e senha no Appwrite
    const sessionRes = await fetch(`${endpoint}/account/sessions/email`, {
      method: "POST",
      headers: {
        "X-Appwrite-Project": projectId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const sessionData = await sessionRes.json();

    if (!sessionRes.ok) {
      return NextResponse.json(
        { error: sessionData.message || "Credenciais inválidas no Appwrite" },
        { status: sessionRes.status }
      );
    }

    // 2. Salva o cookie de sessão seguro no Next.js
    const cookieStore = await cookies();
    cookieStore.set("appwrite-session", sessionData.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      expires: new Date(sessionData.expire),
    });

    // 3. Busca detalhes da conta para obter o nome real
    let userName = email.split("@")[0];
    try {
      const accRes = await fetch(`${endpoint}/account`, {
        headers: {
          "X-Appwrite-Project": projectId,
          "X-Appwrite-Session": sessionData.secret,
        },
      });
      if (accRes.ok) {
        const accData = await accRes.json();
        if (accData.name) userName = accData.name;
      }
    } catch {}

    return NextResponse.json({
      success: true,
      user: {
        id: sessionData.userId,
        email,
        name: userName,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro de autenticação" }, { status: 500 });
  }
}
