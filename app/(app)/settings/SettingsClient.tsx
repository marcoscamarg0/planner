"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Check, User, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types";

interface SettingsClientProps {
  profile: Profile | null;
}

export function SettingsClient({ profile }: SettingsClientProps) {
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: err } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() })
      .eq("id", profile?.id ?? "");

    if (err) {
      setError("Erro ao salvar. Tente novamente.");
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }

    setSaving(false);
  };

  const initials = fullName
    ? fullName
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : profile?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie sua conta e preferências
        </p>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        aria-label="Perfil do usuário"
      >
        <div className="glass rounded-2xl p-6 gradient-border space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <User className="w-4 h-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Perfil</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
              {initials}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {profile?.full_name ?? "Sem nome"}
              </p>
              <p className="text-xs text-muted-foreground">{profile?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="settings-name"
                className="text-sm font-medium text-foreground"
              >
                Nome completo
              </label>
              <input
                id="settings-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome"
                className={cn(
                  "w-full px-4 py-3 rounded-xl bg-muted border border-border",
                  "text-foreground placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
                  "transition-all duration-200 text-sm"
                )}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                E-mail
              </label>
              <input
                type="email"
                value={profile?.email ?? ""}
                disabled
                aria-label="E-mail (não editável)"
                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-muted-foreground text-sm cursor-not-allowed"
              />
            </div>

            {error && (
              <p
                className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              id="settings-save"
              type="submit"
              disabled={saving}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold",
                "transition-all duration-200",
                saved
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
                saving && "opacity-70 cursor-not-allowed"
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : saved ? (
                <>
                  <Check className="w-4 h-4" />
                  Salvo!
                </>
              ) : (
                "Salvar alterações"
              )}
            </button>
          </form>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        aria-label="Segurança"
      >
        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-4 h-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Segurança</h2>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Senha</p>
              <p className="text-xs text-muted-foreground">
                Altere sua senha de acesso
              </p>
            </div>
            <button
              id="settings-change-password"
              className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
              onClick={async () => {
                const supabase = createClient();
                await supabase.auth.resetPasswordForEmail(
                  profile?.email ?? "",
                  { redirectTo: `${window.location.origin}/settings` }
                );
                alert("Link de redefinição enviado para seu e-mail.");
              }}
            >
              Alterar senha
            </button>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">
                Conta Supabase
              </p>
              <p className="text-xs text-muted-foreground">
                ID: {profile?.id?.slice(0, 8)}...
              </p>
            </div>
            <span className="text-xs text-emerald-400 font-medium bg-emerald-400/10 px-2.5 py-1 rounded-full">
              Ativa
            </span>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
