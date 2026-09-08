import { Search, type LucideIcon } from "lucide-react";

export function EmptyState({
  title,
  description,
  icon: Icon = Search,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink/15 bg-canvas-raised/60 px-6 py-16 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-canvas-sunken text-ink-muted">
        <Icon aria-hidden className="h-6 w-6" strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 text-lg font-semibold tracking-tight text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-muted">{description}</p>
      )}
    </div>
  );
}
