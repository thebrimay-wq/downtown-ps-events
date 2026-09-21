"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { categoryMeta } from "@/lib/categories";
import { CategoryIcon } from "./category-icon";

// ---------------------------------------------------------------------------
// An event's artwork, or the category tint when there is none. Scraped image
// URLs rot, and a third of the dataset has had its image cleared already, so
// a request that fails flips to the same tint rather than leaving a broken
// image in the frame. Cards and the detail hero share it so both agree.
// ---------------------------------------------------------------------------

const VARIANTS = {
  card: {
    tint: ["26", "0d"],
    icon: "h-10 w-10 opacity-60",
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
    imageClass: "object-cover transition duration-300 ease-out group-hover:scale-[1.04]",
  },
  hero: {
    tint: ["2e", "0f"],
    icon: "h-16 w-16 opacity-55",
    sizes: "100vw",
    imageClass: "object-cover",
  },
} as const;

export function EventImage({
  src,
  category,
  variant,
  priority,
}: {
  src?: string | null;
  category?: string | null;
  variant: keyof typeof VARIANTS;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // A load that failed before hydration never fires onError afterwards, so
  // ask the element what happened once it is ours.
  useEffect(() => {
    setFailed(false);
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);

  const meta = categoryMeta(category);
  const spec = VARIANTS[variant];

  if (!src || failed) {
    return (
      <div
        className="grid h-full w-full place-items-center"
        style={{
          background: `linear-gradient(135deg, ${meta.color}${spec.tint[0]}, ${meta.color}${spec.tint[1]})`,
          color: meta.color,
        }}
      >
        <CategoryIcon slug={category} className={spec.icon} />
      </div>
    );
  }

  return (
    <>
      <Image
        ref={ref}
        src={src}
        alt=""
        fill
        priority={priority}
        sizes={spec.sizes}
        className={spec.imageClass}
        onError={() => setFailed(true)}
      />
      {/* Darkens the foot of the photo so the card overlapping it reads as a separate layer. */}
      {variant === "hero" && (
        <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" />
      )}
    </>
  );
}
