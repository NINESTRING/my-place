"use client"

import type { PlaceCategory } from "@/generated/prisma/enums"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CATEGORIES, toCategory } from "@/lib/categories"

export function CategoryPicker({
  value,
  onChange,
  labelId,
}: {
  value: PlaceCategory | null
  onChange: (value: PlaceCategory | null) => void
  /** 그룹을 이름 붙이는 FieldLabel 의 id. aria-labelledby 로 연결한다. */
  labelId?: string
}) {
  return (
    <ToggleGroup
      value={value ? [value] : []}
      onValueChange={(next) => onChange(toCategory(next))}
      variant="outline"
      aria-labelledby={labelId}
      // 항목이 5개라 좁은 화면에서 한 줄에 들어가지 않는다. ToggleGroup 의
      // 기본 클래스가 w-fit 이므로 max-w-full 을 함께 줘야 접힌다.
      className="max-w-full flex-wrap justify-start"
    >
      {CATEGORIES.map((category) => (
        <ToggleGroupItem key={category.value} value={category.value}>
          {category.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
