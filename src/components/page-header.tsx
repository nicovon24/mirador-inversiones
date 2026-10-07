export function PageHeader({
  title,
  description,
  live,
  actions,
}: {
  title: string;
  description?: string;
  live?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-[-0.03em] md:text-[1.75rem]">{title}</h1>
          {live && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-up/30 bg-up-soft px-2 py-0.5 text-[11px] font-medium text-up">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-up opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex size-1.5 rounded-full bg-up" />
              </span>
              En vivo
            </span>
          )}
        </div>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
