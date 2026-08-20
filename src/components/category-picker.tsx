"use client"

import type { PlaceCategory } from "@/generated/prisma/enums"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CATEGORIES } from "@/lib/categories"

export function CategoryPicker({
  value,
  onChange,
}: {
  value: PlaceCategory | null
  onChange: (value: PlaceCategory | null) => void
}) {
  return (
    <ToggleGroup
      value={value ? [value] : []}
      onValueChange={(next) => {
        // multiple 이 false 인 ToggleGroup 은 눌린 항목을 다시 누르면 빈
        // 배열을 준다. 옛 코드는 그 빈 배열을 무시해서, 한 번 고른
        // 카테고리를 해제할 방법이 없었다 — 잘못 눌러도 되돌릴 수 없으면
        // 선택 사항이 아니다.
        //
        // 목록에서 찾아 넘기므로 캐스팅 없이 PlaceCategory 로 좁혀진다.
        const selected = CATEGORIES.find((category) => category.value === next[0])
        onChange(selected?.value ?? null)
      }}
      variant="outline"
      // 항목이 5개라 좁은 화면에서 한 줄에 들어가지 않는다. ToggleGroup 의
      // 기본 클래스가 w-fit 이므로 max-w-full 을 함께 줘야 접힌다.
      className="max-w-full flex-wrap justify-start"
    >
      {CATEGORIES.map((category) => (
        <ToggleGroupItem
          key={category.value}
          value={category.value}
          aria-label={category.label}
        >
          {category.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
