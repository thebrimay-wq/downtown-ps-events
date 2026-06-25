export function EmptyState({
  title,
  description,
  icon = "🔍",
}: {
  title: string;
  description?: string;
  icon?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-black/10 bg-canvas-raised/50 px-6 py-16 text-center">
      <div className="text-4xl">{icon}</div>
      <h3 className="mt-4 text-lg font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      )}
    </div>
  );
}
