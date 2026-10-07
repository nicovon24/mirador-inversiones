"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CommandSearch } from "./command-search";
import { Notifications } from "./notifications";
import { NAV, SidebarContent, type SidebarProps } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import type { NotificationView } from "@/server/queries";

function useCrumb() {
  const pathname = usePathname();
  if (pathname.startsWith("/instrument/")) {
    const [, , market, symbol] = pathname.split("/");
    return [
      { label: "Mercados", href: "/markets" },
      { label: `${decodeURIComponent(symbol ?? "")} · ${market}` },
    ];
  }
  const item = NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)));
  return [{ label: item?.label ?? "Resumen" }];
}

export function Topbar({ sidebar, notifications }: { sidebar: SidebarProps; notifications: NotificationView[] }) {
  const crumbs = useCrumb();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú" />}>
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Menú</SheetTitle>
          <SidebarContent {...sidebar} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <nav aria-label="Ruta" className="hidden min-w-0 items-center gap-2 text-sm md:flex">
        <span className="text-muted-foreground">Espacio</span>
        {crumbs.map((c, i) => (
          <span key={i} className="flex min-w-0 items-center gap-2">
            <span className="text-muted-foreground/60" aria-hidden>
              /
            </span>
            {"href" in c && c.href ? (
              <Link href={c.href} className="text-muted-foreground hover:text-foreground">
                {c.label}
              </Link>
            ) : (
              <span className="truncate font-medium">{c.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="ml-auto flex flex-1 items-center justify-end gap-1 md:flex-none">
        <div className="mr-1 flex-1 md:w-80 md:flex-none">
          <CommandSearch />
        </div>
        <Notifications items={notifications} />
        <ThemeToggle />
      </div>
    </header>
  );
}
