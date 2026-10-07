"use client";

import { Bell, BellRing } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate, formatTime } from "@/lib/format";
import { markNotificationsRead } from "@/server/actions";
import type { NotificationView } from "@/server/queries";
import { cn } from "@/lib/utils";

export function Notifications({ items }: { items: NotificationView[] }) {
  const unread = items.filter((n) => !n.read).length;
  const [pending, start] = useTransition();

  return (
    <Popover
      onOpenChange={(open) => {
        if (!open && unread > 0) start(() => void markNotificationsRead());
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={unread ? `Notificaciones, ${unread} sin leer` : "Notificaciones"}
          />
        }
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-background" aria-hidden />
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">Notificaciones</p>
          {unread > 0 && <span className="text-xs text-muted-foreground">{unread} sin leer</span>}
        </div>
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
            <BellRing className="size-5 text-muted-foreground" aria-hidden />
            <p className="text-sm">Sin novedades</p>
            <p className="text-xs text-muted-foreground">
              Cuando se dispare una alerta de precio la vas a ver acá y en Telegram.
            </p>
          </div>
        ) : (
          <ul className={cn("max-h-80 divide-y overflow-y-auto", pending && "opacity-80")}>
            {items.map((n) => (
              <li key={n.id} className="flex gap-3 px-4 py-3">
                <span
                  className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.body}</p>
                  <p className="num mt-1 text-[11px] text-muted-foreground">
                    {formatDate(n.createdAt)} · {formatTime(n.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t px-4 py-2.5">
          <Link href="/alerts" className="text-xs font-medium text-primary hover:underline">
            Ver alertas de precio
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
