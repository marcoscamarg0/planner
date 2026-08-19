"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, User, Mail, Lock, ShieldCheck, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password) {
      setError("Por favor, preencha todos os campos.");
      return;
    }

    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        const msg = signUpError.message.toLowerCase();
        if (msg.includes("already registered") || msg.includes("already exists")) {
          setError("Este e-mail já está cadastrado no sistema.");
        } else if (msg.includes("weak_password") || msg.includes("password")) {
          setError("A senha escolhida é muito fraca. Utilize ao menos 8 caracteres mistos.");
        } else {
          setError(signUpError.message || "Erro ao criar conta. Tente novamente.");
        }
        setLoading(false);
        return;
      }

      if (data?.session) {
        router.push("/dashboard");
        router.refresh();
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 300);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch (err: any) {
      console.error("[Register] Exceção:", err);
      setError(err?.message || "Ocorreu um erro ao criar a conta. Verifique sua conexão.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#009C3B] via-[#FFCC00] via-[#0C326F] to-[#E52207] sticky top-0 z-30 shadow-md" />
        <div className="flex-1 flex items-center justify-center p-4 z-10 my-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-[440px]"
          >
            <div className="bg-[#0B1528]/90 backdrop-blur-2xl rounded-3xl p-8 border border-white/10 shadow-[0_20px_70px_rgba(0,0,0,0.55)] text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
              
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4 text-emerald-400 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              
              <h2 className="text-2xl font-black text-white mb-2 font-heading tracking-tight">
                Confirmação Enviada
              </h2>
              <p className="text-slate-300 text-xs leading-relaxed mb-6">
                Enviamos um link de validação para <span className="text-emerald-400 font-bold">{email}</span>. Acesse seu e-mail para ativar seu acesso ao Planner.
              </p>
              
              <Link
                href="/login"
                className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-600 via-blue-700 to-[#0C326F] text-white hover:from-blue-500 hover:to-blue-700 transition-all inline-flex items-center justify-center shadow-lg shadow-blue-900/30"
              >
                Voltar à tela de login &rarr;
              </Link>
            </div>
          </motion.div>
        </div>
        <div className="h-1.5 w-full bg-gradient-to-r from-[#009C3B] via-[#FFCC00] via-[#0C326F] to-[#E52207] mt-auto z-30" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col justify-between relative overflow-hidden selection:bg-blue-500 selection:text-white font-sans">
      <div className="h-1.5 w-full bg-gradient-to-r from-[#009C3B] via-[#FFCC00] via-[#0C326F] to-[#E52207] sticky top-0 z-30 shadow-md" />

      {/* Atmospheric Glow Backgrounds */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-blue-600/15 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#0C326F]/10 rounded-full blur-[180px]" />
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10 my-auto">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[440px]"
        >
          <div className="bg-[#0B1528]/85 backdrop-blur-2xl rounded-3xl p-7 sm:p-9 border border-white/10 shadow-[0_20px_70px_rgba(0,0,0,0.55)] relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />

            {/* Header */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0C326F] via-[#0047FF] to-[#0A224A] p-0.5 shadow-xl shadow-blue-900/30 flex items-center justify-center mb-4">
                <div className="w-full h-full bg-[#08152B] rounded-[14px] flex items-center justify-center relative overflow-hidden">
                  <div className="w-6 h-6 bg-[#FFCC00] rotate-45 flex items-center justify-center shadow-md">
                    <div className="w-3.5 h-3.5 rounded-full bg-[#002776] flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white tracking-tight font-heading">
                  Criar Conta
                </h1>
                <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md bg-[#0C326F]/80 text-[#FFCC00] border border-[#FFCC00]/30 shadow-xs">
                  MT
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-300 mt-1 uppercase tracking-wider">
                Ministério dos Transportes
              </p>
            </div>

            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="space-y-1.5">
                <label htmlFor="full-name" className="text-xs font-bold text-slate-300">
                  Nome completo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="full-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome completo"
                    required
                    autoComplete="name"
                    className={cn(
                      "w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900/70 border border-slate-700/60",
                      "text-slate-100 placeholder:text-slate-500 text-sm",
                      "focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:bg-slate-900",
                      "transition-all duration-200"
                    )}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-bold text-slate-300">
                  E-mail institucional
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.nome@transportes.gov.br"
                    required
                    autoComplete="email"
                    className={cn(
                      "w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900/70 border border-slate-700/60",
                      "text-slate-100 placeholder:text-slate-500 text-sm",
                      "focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:bg-slate-900",
                      "transition-all duration-200"
                    )}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-bold text-slate-300">
                  Senha de acesso (mínimo 8 caracteres)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className={cn(
                      "w-full pl-10 pr-11 py-2.5 rounded-xl bg-slate-900/70 border border-slate-700/60",
                      "text-slate-100 placeholder:text-slate-500 text-sm",
                      "focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:bg-slate-900",
                      "transition-all duration-200"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 px-3.5 py-2.5 rounded-xl flex items-start gap-2.5"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-400" />
                  <span className="leading-relaxed">{error}</span>
                </motion.div>
              )}

              <button
                id="register-submit"
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full py-3 px-4 rounded-xl font-bold text-sm tracking-wide shadow-lg",
                  "bg-gradient-to-r from-blue-600 via-blue-700 to-[#0C326F] text-white",
                  "hover:from-blue-500 hover:to-blue-700 active:scale-[0.99]",
                  "border border-blue-400/20 shadow-blue-900/30",
                  "transition-all duration-200",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-2 cursor-pointer mt-3 group"
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Criando acesso...</span>
                  </>
                ) : (
                  <>
                    <span>Cadastrar Acesso</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
              <span>Já possui conta?</span>
              <Link
                href="/login"
                className="text-blue-400 hover:text-blue-300 font-bold transition-colors"
              >
                Entrar no Planner &rarr;
              </Link>
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-full backdrop-blur-md">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ambiente Institucional Seguro &bull; SSL 256-bit</span>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="h-1.5 w-full bg-gradient-to-r from-[#009C3B] via-[#FFCC00] via-[#0C326F] to-[#E52207] mt-auto z-30" />
    </div>
  );
}
