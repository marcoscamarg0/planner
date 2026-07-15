import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { AppShell } from "@/components/layout/AppShell";

import { FloatingChat } from "@/components/chat/FloatingChat";

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

  const [
    { data: profile },
    { data: projects }
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("projects")
      .select("*")
      .eq("owner_id", user.id)
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(20)
  ]);

  return (
    <AppShell
      profile={profile}
      projects={projects ?? []}
    >
      {children}
      <FloatingChat />
    </AppShell>
  );
}
