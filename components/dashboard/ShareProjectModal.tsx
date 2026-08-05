"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Shield, UserPlus, Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ProjectWithStats } from "@/types";

interface ShareProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectWithStats;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  profiles: {
    email: string;
    full_name: string | null;
  };
}

export function ShareProjectModal({ isOpen, onClose, project }: ShareProjectModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
      fetchMembers();
      setEmail("");
      setErrorMsg("");
      setSuccessMsg("");
    }
  }, [isOpen]);

  const fetchMembers = async () => {
    setLoadingMembers(true);
    // Fetch members and join with profiles
    const { data, error } = await supabase
      .from("project_members")
      .select("id, user_id, role, profiles(email, full_name)")
      .eq("project_id", project.id);
    
    if (data) {
      // Cast the joined data
      setMembers(data as unknown as Member[]);
    }
    setLoadingMembers(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/projects/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          email,
          role
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao convidar membro");
      }

      setSuccessMsg("Membro adicionado com sucesso!");
      setEmail("");
      fetchMembers();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("Tem certeza que deseja remover este membro?")) return;
    
    try {
      const res = await fetch(`/api/projects/share?projectId=${project.id}&userId=${userId}`, {
        method: "DELETE"
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao remover membro");
      }
      
      fetchMembers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Compartilhar Projeto</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <form onSubmit={handleInvite} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Convidar por E-mail
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@exemplo.com"
                      required
                      className="w-full pl-9 pr-3 py-2 bg-accent/50 border border-border rounded-lg text-sm focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="px-3 py-2 bg-accent/50 border border-border rounded-lg text-sm focus:outline-none"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Leitor</option>
                  </select>
                </div>
              </div>

              {errorMsg && <p className="text-sm text-destructive font-medium">{errorMsg}</p>}
              {successMsg && <p className="text-sm text-emerald-500 font-medium">{successMsg}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Convidar Membro
              </button>
            </form>

            <div className="pt-4 border-t border-border">
              <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-muted-foreground" />
                Membros da Equipe
              </h3>

              {loadingMembers ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : members.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center p-4 bg-accent/30 rounded-lg">
                  Apenas você tem acesso a este projeto.
                </p>
              ) : (
                <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {members.map((member) => (
                    <li key={member.id} className="flex items-center justify-between p-2 rounded-lg border border-border bg-accent/30">
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-foreground truncate">
                          {member.profiles?.full_name || member.profiles?.email}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {member.profiles?.email}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 ml-2">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {member.role === 'editor' ? 'Editor' : 'Leitor'}
                        </span>
                        <button
                          onClick={() => handleRemove(member.user_id)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                          title="Remover membro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
