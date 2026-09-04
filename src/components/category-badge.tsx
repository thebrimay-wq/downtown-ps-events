import { categoryMeta } from "@/lib/categories";
import { CategoryIcon } from "./category-icon";
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
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        className,
      )}
      style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
    >
      {withIcon && <CategoryIcon slug={slug} className="h-3.5 w-3.5" />}
      {meta.label}
    </span>
  );
}
