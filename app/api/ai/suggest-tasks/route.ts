import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callOpenRouter } from "@/lib/openrouter/client";
import { buildSuggestTasksPrompt } from "@/lib/openrouter/prompts";

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
    const { projectTitle, projectDescription, existingTasks } = body;

    const messages = buildSuggestTasksPrompt(
      projectTitle,
      projectDescription ?? "",
      existingTasks ?? []
    );

    const raw = await callOpenRouter(messages, {
      max_tokens: 512,
      temperature: 0.7,
    });

    let suggestions: string[] = [];

    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      }
    } catch {
      suggestions = raw
        .split("\n")
        .map((l: string) => l.replace(/^[-*\d.]+\s*/, "").trim())
        .filter((l: string) => l.length > 3)
        .slice(0, 5);
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("AI suggest-tasks error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
