// Presentation metadata for category slugs. Used by cards/badges so they can
// render an icon + color without an async DB lookup. The DB remains the source
// of truth for which categories exist; this is purely visual fallback styling.

export interface CategoryMeta {
  label: string;
  // Mirrors event_categories.icon in the database. The UI renders vector icons
  // from <CategoryIcon> instead; this is kept only for data parity.
  icon: string;
  color: string;
}

export const CATEGORY_META: Record<string, CategoryMeta> = {
  music: { label: "Live Music", icon: "🎵", color: "#d9791f" },
  arts: { label: "Arts & Culture", icon: "🎨", color: "#9d4a1a" },
  "food-drink": { label: "Food & Drink", icon: "🍷", color: "#c0611a" },
  family: { label: "Family & Kids", icon: "🧸", color: "#e3923a" },
  market: { label: "Markets", icon: "🧺", color: "#7f3c1c" },
  community: { label: "Community", icon: "🤝", color: "#68331b" },
  sports: { label: "Sports & Fitness", icon: "🏃", color: "#d9791f" },
  festival: { label: "Festivals", icon: "🎪", color: "#c0611a" },
  education: { label: "Education", icon: "📚", color: "#9d4a1a" },
  nightlife: { label: "Nightlife", icon: "🌙", color: "#7f3c1c" },
  other: { label: "Other", icon: "📌", color: "#8e8e93" },
};

export function categoryMeta(slug?: string | null): CategoryMeta {
  return (slug && CATEGORY_META[slug]) || CATEGORY_META.other;
}
