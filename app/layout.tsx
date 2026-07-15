import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Planner — Organização Inteligente",
    template: "%s | Planner",
  },
  description:
    "Organize projetos, gerencie tarefas e obtenha insights inteligentes com IA integrada. Seu workspace de produtividade completo.",
  keywords: ["planner", "organização", "projetos", "tarefas", "produtividade"],
  authors: [{ name: "Planner" }],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    title: "Planner — Organização Inteligente",
    description:
      "Organize projetos, gerencie tarefas e obtenha insights inteligentes com IA integrada.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
