"use client";

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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createAlert } from "@/server/actions";

type Condition = "ABOVE" | "BELOW" | "PCT_CHANGE";

const CONDITIONS: { value: Condition; label: string; hint: string }[] = [
  { value: "ABOVE", label: "Sube a", hint: "Avisar cuando el precio llegue o supere" },
  { value: "BELOW", label: "Baja a", hint: "Avisar cuando el precio llegue o perfore" },
  { value: "PCT_CHANGE", label: "Varía %", hint: "Avisar si se mueve ± este % desde ahora" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instrumentKey: string;
  symbol: string;
  name?: string | null;
  price?: number | null;
}

export function CreateAlertDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* El formulario se monta al abrir: arranca limpio y con un objetivo sugerido. */}
        {props.open && <AlertForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function suggest(price: number | null | undefined, c: Condition) {
  if (c === "PCT_CHANGE") return "5";
  return price ? formatNumber(c === "BELOW" ? price * 0.95 : price * 1.05, 2) : "";
}

function AlertForm({ onOpenChange, instrumentKey, symbol, name, price }: Props) {
  const [condition, setCondition] = useState<Condition>("ABOVE");
  const [target, setTarget] = useState(() => suggest(price, "ABOVE"));
  const [touched, setTouched] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Si el precio llega después de abrir, completamos la sugerencia mientras no se haya tocado el campo.
  const shownTarget = !touched && !target && price ? suggest(price, condition) : target;

  const pickCondition = (c: Condition) => {
    setCondition(c);
    setTouched(false);
    setTarget(suggest(price, c));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await createAlert({ key: instrumentKey, name, condition, target: shownTarget, repeat, note });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`Alerta creada para ${symbol}`);
      onOpenChange(false);
    });
  };

  const hint = CONDITIONS.find((c) => c.value === condition)?.hint;

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>Alerta de precio · {symbol}</DialogTitle>
        <DialogDescription>
          {price ? <>Precio actual <span className="num font-medium text-foreground">{formatNumber(price)}</span>. </> : null}
          Te avisamos acá y por Telegram, aunque tengas la app cerrada.
        </DialogDescription>
      </DialogHeader>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Condición</legend>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="radiogroup">
          {CONDITIONS.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={condition === c.value}
              onClick={() => pickCondition(c.value)}
              className={cn(
                "h-8 cursor-pointer rounded-md text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                condition === c.value
                  ? "bg-card font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor="alert-target">{condition === "PCT_CHANGE" ? "Variación (%)" : "Precio objetivo"}</Label>
        <Input
          id="alert-target"
          inputMode="decimal"
          value={shownTarget}
          onChange={(e) => {
            setTouched(true);
            setTarget(e.target.value);
          }}
          className="num"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "alert-error" : undefined}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="alert-note">Nota (opcional)</Label>
        <Input
          id="alert-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej.: zona de compra"
          maxLength={140}
        />
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
        <span className="grid gap-0.5">
          <span className="text-sm font-medium">Repetir</span>
          <span className="text-xs text-muted-foreground">Sigue activa después de avisar (máximo un aviso por hora)</span>
        </span>
        <Switch checked={repeat} onCheckedChange={setRepeat} />
      </label>

      {error && (
        <p id="alert-error" className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending || !shownTarget.trim()}>
          {pending ? "Creando…" : "Crear alerta"}
        </Button>
      </DialogFooter>
    </form>
  );
}
