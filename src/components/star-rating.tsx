"use client"

import { cn } from "@/lib/utils"

const STARS = [1, 2, 3, 4, 5]

export function StarRating({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="별점">
      {STARS.map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star}점`}
          onClick={() => onChange(star)}
          className={cn(
            "focus-visible:ring-ring rounded text-2xl leading-none transition-colors focus-visible:ring-2 focus-visible:outline-none",
            star <= value ? "text-amber-400" : "text-muted-foreground/40"
          )}
        >
          ★
        </button>
      ))}
    </div>
  )
}
