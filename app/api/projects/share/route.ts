import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const serviceClient = await createServiceClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, email, role } = await req.json();

    if (!projectId || !email || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if the current user is the owner of the project
    const { data: project } = await supabase
      .from("projects")
      .select("owner_id")
      .eq("id", projectId)
      .single();

    if (!project || project.owner_id !== user.id) {
      return NextResponse.json({ error: "Apenas o dono do projeto pode convidar membros" }, { status: 403 });
    }

    // Lookup user by email using service client to bypass RLS
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Usuário com esse e-mail não encontrado na plataforma" }, { status: 404 });
    }

    if (profile.id === user.id) {
      return NextResponse.json({ error: "Você não pode convidar a si mesmo" }, { status: 400 });
    }

    // Check if already a member
    const { data: existingMember } = await serviceClient
      .from("project_members")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", profile.id)
      .single();

    if (existingMember) {
      return NextResponse.json({ error: "O usuário já é membro deste projeto" }, { status: 400 });
    }

    // Insert into project_members
    const { error: insertError } = await serviceClient
      .from("project_members")
      .insert({
        project_id: projectId,
        user_id: profile.id,
        role: role
      });

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ success: true, message: "Membro adicionado com sucesso" });

  } catch (error: any) {
    console.error("Error sharing project:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const serviceClient = await createServiceClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const targetUserId = url.searchParams.get("userId");

    if (!projectId || !targetUserId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if the current user is the owner
    const { data: project } = await supabase
      .from("projects")
      .select("owner_id")
      .eq("id", projectId)
      .single();

    if (!project || project.owner_id !== user.id) {
      // Allow user to leave project if they are not the owner
      if (user.id !== targetUserId) {
        return NextResponse.json({ error: "Apenas o dono pode remover outros membros" }, { status: 403 });
      }
    }

    const { error: deleteError } = await serviceClient
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", targetUserId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true, message: "Membro removido com sucesso" });

  } catch (error: any) {
    console.error("Error removing member:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
