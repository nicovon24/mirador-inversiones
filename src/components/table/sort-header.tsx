"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";
export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

/** Encabezado de columna ordenable: click ordena, otro click invierte. Expone el estado con aria-sort. */
export function SortHeader<K extends string>({
  k,
  label,
  align = "right",
  sort,
  onSort,
  extra,
  className,
}: {
  k: K;
  label: string;
  align?: "left" | "right";
  sort: SortState<K>;
  onSort: (k: K) => void;
  /** Contenido al lado del título, p. ej. un ícono de ayuda. */
  extra?: React.ReactNode;
  className?: string;
}) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={cn("px-4 py-2.5 font-medium", align === "right" && "text-right", className)}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => onSort(k)}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 rounded transition-colors hover:text-foreground",
            active && "text-foreground",
          )}
        >
          {label}
          <Icon className={cn("size-3", !active && "opacity-50")} aria-hidden />
        </button>
        {extra}
      </span>
    </th>
  );
}

/** Siguiente estado de orden: misma columna invierte; columna nueva arranca con su dirección natural. */
export function nextSort<K extends string>(current: SortState<K>, key: K, naturalDir: (k: K) => SortDir): SortState<K> {
  return current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: naturalDir(key) };
}
