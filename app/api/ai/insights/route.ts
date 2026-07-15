import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callOpenRouter } from "@/lib/openrouter/client";
import { buildInsightPrompt } from "@/lib/openrouter/prompts";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { projectTitle, stats, projectId } = body;

    const messages = buildInsightPrompt(projectTitle, stats);
    const insight = await callOpenRouter(messages, {
      max_tokens: 128,
      temperature: 0.6,
    });

    if (projectId && insight) {
      await supabase.from("ai_insights").insert({
        project_id: projectId,
        content: insight,
        type: "progress",
      });
    }

    return NextResponse.json({ insight });
  } catch (error) {
    console.error("AI insights error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
