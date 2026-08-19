"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, AlertCircle, ShieldCheck, Lock, Mail, ArrowRight, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    const errParam = searchParams.get("error");
    if (errParam === "callback_failed") {
      setError("Não foi possível validar seu link de autenticação. Tente entrar novamente.");
    } else if (errParam === "unauthorized") {
      setInfoMessage("Sua sessão expirou ou é necessário autenticar para continuar.");
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Por favor, preencha todos os campos.");
      return;
    }

    setLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        const msg = authError.message.toLowerCase();
        if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
          setError("E-mail não confirmado. Verifique sua caixa de entrada para confirmar sua conta.");
        } else if (msg.includes("invalid login credentials") || msg.includes("invalid credentials")) {
          setError("E-mail ou senha incorretos. Verifique suas credenciais.");
        } else if (msg.includes("too many requests") || msg.includes("rate limit")) {
          setError("Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.");
        } else if (msg.includes("user not found")) {
          setError("Nenhuma conta encontrada com este e-mail.");
        } else {
          setError(authError.message || "E-mail ou senha incorretos. Tente novamente.");
        }
        setLoading(false);
        return;
      }

      if (!data?.session) {
        setError("Não foi possível iniciar a sessão. Verifique se seu e-mail foi confirmado.");
        setLoading(false);
        return;
      }

      // Redirecionamento instantâneo
      router.push("/dashboard");
      router.refresh();

      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 300);
    } catch (err: any) {
      console.error("[Login] Exceção:", err);
      setError(err?.message || "Ocorreu um erro de conexão. Verifique sua internet e tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col justify-between relative overflow-hidden selection:bg-blue-500 selection:text-white font-sans">
      {/* Top Gov.br Institutional Geometric Strip */}
      <div className="h-1.5 w-full bg-gradient-to-r from-[#009C3B] via-[#FFCC00] via-[#0C326F] to-[#E52207] sticky top-0 z-30 shadow-md" />

      {/* Atmospheric Glow Backgrounds */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-blue-600/15 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#0C326F]/10 rounded-full blur-[180px]" />
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10 my-auto">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[440px]"
        >
          {/* Glass Card */}
          <div className="bg-[#0B1528]/85 backdrop-blur-2xl rounded-3xl p-7 sm:p-9 border border-white/10 shadow-[0_20px_70px_rgba(0,0,0,0.55)] relative overflow-hidden">
            {/* Top subtle highlight shimmer */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />

            {/* Header: Institutional Branding */}
            <div className="flex flex-col items-center text-center mb-8">
              {/* Emblem */}
              <div className="relative mb-4 group">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0C326F] via-[#0047FF] to-[#0A224A] p-0.5 shadow-xl shadow-blue-900/30 flex items-center justify-center">
                  <div className="w-full h-full bg-[#08152B] rounded-[14px] flex items-center justify-center relative overflow-hidden">
                    {/* Brazil Flag Diamond */}
                    <div className="w-6 h-6 bg-[#FFCC00] rotate-45 flex items-center justify-center shadow-md">
                      <div className="w-3.5 h-3.5 rounded-full bg-[#002776] flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#0B1528] flex items-center justify-center shadow-sm" title="Sistema Operacional Online">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                </div>
              </div>

              {/* Title & Tagline */}
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white tracking-tight font-heading">
                  Planner
                </h1>
                <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md bg-[#0C326F]/80 text-[#FFCC00] border border-[#FFCC00]/30 shadow-xs">
                  MT
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-300 mt-1 uppercase tracking-wider">
                Ministério dos Transportes
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Governo Federal &bull; Sistema de Gestão & QA
              </p>
            </div>

            {infoMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 text-xs text-sky-300 bg-sky-500/10 border border-sky-500/20 px-3.5 py-2.5 rounded-xl flex items-center gap-2.5"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-sky-400" />
                <span>{infoMessage}</span>
              </motion.div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-xs font-bold text-slate-300 flex items-center justify-between"
                >
                  <span>E-mail institucional</span>
                  <span className="text-[10px] text-slate-400 font-normal">gov.br</span>
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
                <label
                  htmlFor="password"
                  className="text-xs font-bold text-slate-300 flex items-center justify-between"
                >
                  <span>Senha de acesso</span>
                  <span className="text-[10px] text-slate-400 font-normal">Privada</span>
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
                    autoComplete="current-password"
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
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
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
                id="login-submit"
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
                    <span>Autenticando sessão...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar no Sistema</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Footer Registration Link */}
            <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
              <span>Primeiro acesso?</span>
              <Link
                href="/register"
                className="text-blue-400 hover:text-blue-300 font-bold transition-colors flex items-center gap-1"
              >
                Criar conta institucional &rarr;
              </Link>
            </div>
          </div>

          {/* Bottom Trust & Security Badges */}
          <div className="mt-6 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-full backdrop-blur-md">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ambiente Seguro &bull; Criptografia 256-bit SSL</span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium text-center">
              Ministério dos Transportes &bull; Governo Federal do Brasil
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom Gov.br Institutional Geometric Strip */}
      <div className="h-1.5 w-full bg-gradient-to-r from-[#009C3B] via-[#FFCC00] via-[#0C326F] to-[#E52207] mt-auto z-30" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070D18] flex items-center justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
