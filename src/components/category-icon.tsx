import {
  Blocks,
  CalendarDays,
  Dumbbell,
  GraduationCap,
  Martini,
  Music,
  Palette,
  PartyPopper,
  ShoppingBasket,
  Users,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// One icon per category slug. Vector icons rather than emoji: emoji render
// differently on every platform and can't take a stroke width or a colour.
const ICONS: Record<string, LucideIcon> = {
  music: Music,
  arts: Palette,
  "food-drink": Wine,
  family: Blocks,
  market: ShoppingBasket,
  community: Users,
  sports: Dumbbell,
  festival: PartyPopper,
  education: GraduationCap,
  nightlife: Martini,
  other: CalendarDays,
};

export function categoryIcon(slug?: string | null): LucideIcon {
  return (slug && ICONS[slug]) || ICONS.other;
}

export function CategoryIcon({
  slug,
  className,
}: {
  slug?: string | null;
  className?: string;
}) {
  const Icon = categoryIcon(slug);
  return (
    <Icon
      aria-hidden
      strokeWidth={2}
      className={cn("h-4 w-4 shrink-0", className)}
    />
  );
}
