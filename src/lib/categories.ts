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
  music: { label: "Live Music", icon: "🎵", color: "#7A3B4A" },
  arts: { label: "Arts & Culture", icon: "🎨", color: "#5B5236" },
  "food-drink": { label: "Food & Drink", icon: "🍷", color: "#8A4A26" },
  family: { label: "Family & Kids", icon: "🧸", color: "#5E6A4A" },
  market: { label: "Markets", icon: "🧺", color: "#7A6230" },
  community: { label: "Community", icon: "🤝", color: "#4A5A5E" },
  sports: { label: "Sports & Fitness", icon: "🏃", color: "#4C6250" },
  festival: { label: "Festivals", icon: "🎪", color: "#8E3F34" },
  education: { label: "Education", icon: "📚", color: "#4C5068" },
  nightlife: { label: "Nightlife", icon: "🌙", color: "#46425A" },
  other: { label: "Other", icon: "📌", color: "#6A6157" },
};

export function categoryMeta(slug?: string | null): CategoryMeta {
  return (slug && CATEGORY_META[slug]) || CATEGORY_META.other;
}
