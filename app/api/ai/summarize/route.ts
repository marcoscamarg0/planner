import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callOpenRouter } from "@/lib/openrouter/client";
import { buildSummarizePrompt } from "@/lib/openrouter/prompts";

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
    const { pageId, projectId, title, content } = body;

    if (!content || content.length < 50) {
      return NextResponse.json({ insight: null });
    }

    const messages = buildSummarizePrompt(title, content);
    const summary = await callOpenRouter(messages, {
      max_tokens: 256,
      temperature: 0.3,
    });

    let insight = null;

    if (projectId && summary) {
      const { data } = await supabase
        .from("ai_insights")
        .insert({
          project_id: projectId,
          page_id: pageId ?? null,
          content: summary,
          type: "summary",
        })
        .select()
        .single();

      insight = data;
    }

    return NextResponse.json({ summary, insight });
  } catch (error) {
    console.error("AI summarize error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
