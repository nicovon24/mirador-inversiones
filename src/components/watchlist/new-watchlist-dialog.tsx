"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWatchlist, renameWatchlist } from "@/server/actions";

/** Crear lista nueva o, si recibe `watchlist`, renombrarla. */
export function NewWatchlistDialog({
  trigger,
  watchlist,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: React.ReactElement;
  watchlist?: { id: string; name: string };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (o: boolean) => {
    setInnerOpen(o);
    onOpenChange?.(o);
  };
  const [name, setName] = useState(watchlist?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = watchlist ? await renameWatchlist(watchlist.id, name) : await createWatchlist(name);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      toast.success(watchlist ? "Lista renombrada" : `Lista “${name.trim()}” creada`);
      if (!watchlist && res.data) router.push(`/watchlist?list=${res.data.id}`);
      if (!watchlist) setName("");
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setError(null);
      }}
    >
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{watchlist ? "Renombrar lista" : "Nueva lista"}</DialogTitle>
            <DialogDescription>
              {watchlist ? "Elegí un nombre nuevo." : "Agrupá instrumentos para seguirlos juntos."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="watchlist-name">Nombre</Label>
            <Input
              id="watchlist-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej.: Tecnológicas, Bonos en USD"
              maxLength={40}
              autoFocus
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "watchlist-error" : undefined}
            />
            {error && (
              <p id="watchlist-error" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Guardando…" : watchlist ? "Guardar" : "Crear lista"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
