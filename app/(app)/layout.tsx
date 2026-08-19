import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import type { Profile, Project } from "@/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let [
    { data: rawProfile },
    { data: rawProjects }
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, role")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("projects")
      .select("id, title, color, emoji, status, parent_id, updated_at")
      .or(`owner_id.eq.${user.id},owner_id.is.null`)
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(30)
  ]);

  let profile = rawProfile as Profile | null;
  let projects = (rawProjects as Project[]) ?? [];

  // Fallback com Service Role se necessário
  if ((!profile || projects.length === 0) && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = await createServiceClient();
      const [adminProfRes, adminProjRes] = await Promise.all([
        !profile ? admin.from("profiles").select("id, full_name, email, avatar_url, role").eq("id", user.id).maybeSingle() : Promise.resolve({ data: profile }),
        projects.length === 0 ? admin.from("projects").select("id, title, color, emoji, status, parent_id, updated_at").neq("status", "archived").order("updated_at", { ascending: false }).limit(30) : Promise.resolve({ data: projects })
      ]);
      if (adminProfRes.data) profile = adminProfRes.data as Profile;
      if (adminProjRes.data && adminProjRes.data.length > 0) projects = adminProjRes.data as Project[];
    } catch {}
  }

  // Garante perfil consistente mesmo se não existir registro na tabela profiles
  const safeProfile: Profile = profile ?? {
    id: user.id,
    email: user.email ?? "",
    full_name: (user.user_metadata?.full_name as string) || (user.email ? user.email.split("@")[0] : "Usuário"),
    avatar_url: (user.user_metadata?.avatar_url as string) || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <AppShell
      profile={safeProfile}
      projects={projects}
    >
      {children}
    </AppShell>
  );
}
