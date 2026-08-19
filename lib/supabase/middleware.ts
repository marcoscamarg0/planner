import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Ignora rotas de API, estáticas, assets, share e arquivos com extensão
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/share") ||
    pathname.startsWith("/reports") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register");

  const hasSession = request.cookies.has("appwrite-session");

  // Se não tem sessão e está tentando acessar rota protegida, vai para o login
  if (!hasSession && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Se tem sessão e está na tela de login/cadastro, redireciona para o dashboard
  if (hasSession && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
