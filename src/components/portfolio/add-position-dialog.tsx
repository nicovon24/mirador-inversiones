"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SymbolAvatar } from "@/components/market/symbol-avatar";
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
import { InstrumentPicker } from "@/components/watchlist/instrument-picker";
import type { SearchResult } from "@/lib/market/types";
import { cn } from "@/lib/utils";
import { createPosition } from "@/server/actions";

export function AddPositionDialog() {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [quantity, setQuantity] = useState("");
  const [avgPrice, setAvgPrice] = useState("");
  const [currency, setCurrency] = useState<"ARS" | "USD">("ARS");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const reset = () => {
    setPicked(null);
    setQuantity("");
    setAvgPrice("");
    setError(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked) return setError("Elegí un instrumento");
    start(async () => {
      const res = await createPosition({
        key: `${picked.market}:${picked.symbol}`,
        name: picked.name,
        quantity,
        avgPrice,
        currency,
      });
      if (!res.ok) return setError(res.error);
      toast.success(`Posición en ${picked.symbol} agregada`);
      setOpen(false);
      reset();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <Plus /> Posición manual
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Agregar posición manual</DialogTitle>
            <DialogDescription>Para tenencias en otros brokers. Se valúan con el precio en vivo.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label>Instrumento</Label>
            <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
              {picked ? (
                <>
                  <SymbolAvatar symbol={picked.symbol} market={picked.market} className="size-7" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{picked.symbol}</span>
                    <span className="block truncate text-xs text-muted-foreground">{picked.name}</span>
                  </span>
                </>
              ) : (
                <span className="flex-1 text-sm text-muted-foreground">Ninguno elegido</span>
              )}
              <InstrumentPicker
                onPick={(r) => {
                  setPicked(r);
                  setCurrency(r.market === "US" || /[DC]$/.test(r.symbol) ? "USD" : "ARS");
                }}
                trigger={<Button type="button" variant="secondary" size="sm" />}
                label={picked ? "Cambiar" : "Elegir"}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="pos-qty">Cantidad</Label>
              <Input id="pos-qty" inputMode="decimal" className="num" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pos-price">Precio promedio</Label>
              <Input id="pos-price" inputMode="decimal" className="num" value={avgPrice} onChange={(e) => setAvgPrice(e.target.value)} required />
            </div>
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Moneda del precio</legend>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {(["ARS", "USD"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={currency === c}
                  onClick={() => setCurrency(c)}
                  className={cn(
                    "h-8 cursor-pointer rounded-md text-sm transition-colors",
                    currency === c ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c === "ARS" ? "Pesos" : "Dólares"}
                </button>
              ))}
            </div>
          </fieldset>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={pending || !picked || !quantity || !avgPrice}>
              {pending ? "Guardando…" : "Agregar posición"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
