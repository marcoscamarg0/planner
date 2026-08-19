import { NextResponse } from "next/server";
import { appwriteRest } from "@/lib/appwrite/rest";
import { appwriteConfig } from "@/lib/appwrite/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey =
    process.env.APPWRITE_API_KEY ||
    appwriteConfig.apiKey ||
    "";

  const diagnostics: Record<string, any> = {
    endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || appwriteConfig.endpoint,
    projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || appwriteConfig.projectId,
    apiKeyConfigured: Boolean(apiKey && apiKey.trim().length > 10),
    apiKeySnippet: apiKey ? `${apiKey.slice(0, 12)}...${apiKey.slice(-6)}` : "Não configurada",
    databaseId: appwriteConfig.databaseId,
    conexao: "testando...",
    detalhes: null,
  };

  try {
    const dbList = await appwriteRest.listDatabases();
    const databasesArray: any[] = dbList.databases || [];
    const plannerDb = databasesArray.find(
      (d) => d.$id === appwriteConfig.databaseId || d.name?.toLowerCase().includes("planner")
    );

    if (plannerDb) {
      const colList = await appwriteRest.listCollections(plannerDb.$id);
      diagnostics.conexao = "✅ CONEXÃO COM O APPWRITE 100% OK!";
      diagnostics.bancoEncontrado = `${plannerDb.name} (${plannerDb.$id})`;
      diagnostics.totalColecoes = (colList.collections || []).length;
      diagnostics.colecoes = (colList.collections || []).map((c: any) => `${c.name} (${c.$id})`);
    } else {
      diagnostics.conexao = "✅ Autenticado no Appwrite! O banco planner_db ainda não foi criado.";
      diagnostics.acaoRecomendada = "Acesse http://localhost:3000/api/init-appwrite para criar o banco e as coleções agora.";
    }

    return NextResponse.json({
      status: "Sucesso",
      diagnostics,
    });
  } catch (err: any) {
    diagnostics.conexao = "❌ Falha ao comunicar com a API do Appwrite";
    diagnostics.erroMensagem = err.message;
    diagnostics.dica = "Verifique se a chave de API no painel do Appwrite possui a permissão 'databases.read'.";

    return NextResponse.json({
      status: "Erro na Conexão",
      diagnostics,
    });
  }
}
