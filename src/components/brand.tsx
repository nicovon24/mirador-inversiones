import { cn } from "@/lib/utils";

/** Marca "mirador": un horizonte con un punto de observación. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7 text-primary", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path
        d="M7 21.5 12.5 15l4 4 4.5-6.5 4 4.5"
        fill="none"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="21" cy="10" r="1.9" fill="white" />
    </svg>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="text-[1.35rem] leading-none font-semibold tracking-[-0.04em]">
        mirador<span className="text-primary">.</span>
      </span>
    </span>
  );
}
