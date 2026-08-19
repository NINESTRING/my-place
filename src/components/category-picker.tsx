"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CATEGORIES } from "@/lib/categories"

export function CategoryPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <ToggleGroup
      value={[String(value)]}
      onValueChange={(next) => {
        const selected = next[0]
        if (selected) onChange(Number(selected))
      }}
      variant="outline"
      className="justify-start"
    >
      {CATEGORIES.map((category) => (
        <ToggleGroupItem
          key={category.value}
          value={String(category.value)}
          aria-label={category.label}
        >
          {category.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
