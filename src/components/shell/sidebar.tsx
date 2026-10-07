"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BookOpen, Briefcase, CandlestickChart, GraduationCap, LayoutGrid, Microscope, Plus, Settings, Star } from "lucide-react";
import { Brand } from "@/components/brand";
import { NewWatchlistDialog } from "@/components/watchlist/new-watchlist-dialog";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/", label: "Resumen", icon: LayoutGrid },
  { href: "/markets", label: "Mercados", icon: CandlestickChart },
  { href: "/research", label: "Investigación", icon: Microscope },
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/portfolio", label: "Portafolio", icon: Briefcase },
  { href: "/alerts", label: "Alertas de precio", icon: Bell },
  { href: "/learn", label: "Aprender", icon: GraduationCap },
  { href: "/glossary", label: "Glosario", icon: BookOpen },
  { href: "/settings", label: "Ajustes", icon: Settings },
] as const;

export interface SidebarProps {
  watchlists: { id: string; name: string; count: number }[];
  alertCount: number;
  onNavigate?: () => void;
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SidebarContent({ watchlists, alertCount, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col gap-6 px-3 py-5">
      <Link href="/" onClick={onNavigate} className="rounded-lg px-2 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
        <Brand />
      </Link>

      <nav aria-label="Principal" className="flex flex-col gap-0.5">
        <p className="px-2.5 pb-2 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">Espacio</p>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm text-sidebar-foreground/80 transition-colors outline-none",
                "hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-[18px] shrink-0" aria-hidden />
              <span className="flex-1">{label}</span>
              {href === "/alerts" && alertCount > 0 && (
                <span className="num rounded-md bg-muted px-1.5 text-[11px] leading-5 font-medium text-muted-foreground group-aria-[current=page]:bg-card">
                  {alertCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-0.5 border-t pt-5">
        <div className="flex items-center justify-between px-2.5 pb-2">
          <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">Tus listas</p>
          <NewWatchlistDialog
            trigger={
              <button
                type="button"
                className="-mr-1 inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                aria-label="Crear lista"
              >
                <Plus className="size-4" />
              </button>
            }
          />
        </div>
        {watchlists.length === 0 && <p className="px-2.5 text-xs text-muted-foreground">Todavía no creaste listas.</p>}
        {watchlists.map((w) => {
          const href = `/watchlist?list=${w.id}`;
          return (
            <Link
              key={w.id}
              href={href}
              onClick={onNavigate}
              className="flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="size-1.5 rounded-full bg-primary/70" aria-hidden />
              <span className="flex-1 truncate">{w.name}</span>
              <span className="num text-[11px] text-muted-foreground">{w.count}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 overflow-y-auto border-r bg-sidebar lg:block">
      <SidebarContent {...props} />
    </aside>
  );
}
