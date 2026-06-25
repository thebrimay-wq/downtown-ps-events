import { categoryMeta } from "@/lib/categories";
import { cn } from "@/lib/utils";

export function CategoryBadge({
  slug,
  className,
  withIcon = true,
}: {
  slug?: string | null;
  className?: string;
  withIcon?: boolean;
}) {
  const meta = categoryMeta(slug);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        className,
      )}
      style={{
        backgroundColor: `${meta.color}1a`,
        color: meta.color,
      }}
    >
      {withIcon && <span aria-hidden>{meta.icon}</span>}
      {meta.label}
    </span>
  );
}
