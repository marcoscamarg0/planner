import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callOpenRouter } from "@/lib/openrouter/client";
import { buildMagicAddPrompt } from "@/lib/openrouter/prompts";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { text, projectId } = body;

    if (!text || !projectId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const messages = buildMagicAddPrompt(text);
    const rawResponse = await callOpenRouter(messages, {
      max_tokens: 1024,
      temperature: 0.2, // Low temp for more deterministic JSON
    });

    // Clean up markdown block if the model wraps the response
    let jsonStr = rawResponse.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```/, "").replace(/```$/, "").trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse Magic Add AI response:", jsonStr);
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    const { tasks, note } = parsed;
    const results = { tasksCreated: 0, pageCreated: false };

    // Insert Note as a new Page if it exists
    let newPageId = null;
    if (note && note.trim().length > 0) {
      const { data: pageData } = await supabase
        .from("pages")
        .insert({
          project_id: projectId,
          title: "Nota Rápida (Magic Add)",
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: note }]
              }
            ]
          },
        })
        .select()
        .single();
      
      if (pageData) {
        newPageId = pageData.id;
        results.pageCreated = true;
      }
    }

    // Insert Tasks
    if (tasks && Array.isArray(tasks) && tasks.length > 0) {
      const tasksToInsert = tasks.map(t => ({
        project_id: projectId,
        page_id: newPageId, // link to the note if we created one
        title: t.title || "Nova demanda governamental",
        status: "todo",
        priority: ["low", "medium", "high", "urgent"].includes(t.priority) ? t.priority : "medium",
        due_date: t.due_date || null
      }));

      const { data: tasksData } = await supabase.from("tasks").insert(tasksToInsert).select();
      if (tasksData) {
        results.tasksCreated = tasksData.length;
      }
    }

    return NextResponse.json({ success: true, results, raw: parsed });
  } catch (error) {
    console.error("AI magic-add error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
