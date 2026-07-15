"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderKanban, Settings, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projetos", icon: FolderKanban },
  { href: "/settings", label: "Config.", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border safe-area-pb"
      aria-label="Navegação mobile"
    >
      <ul className="flex items-center justify-around px-2 py-2" role="list">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all duration-200",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
                    isActive ? "bg-primary/15" : "bg-transparent"
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}

        <li className="flex-1">
          <div className="flex flex-col items-center gap-1 py-2 px-3">
            <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <span className="text-[10px] font-medium text-primary">IA</span>
          </div>
        </li>
      </ul>
    </nav>
  );
}
