import type { PlaceCategory } from "@/generated/prisma/enums"

export const CATEGORIES = [
  { value: "CAFE", label: "카페" },
  { value: "RESTAURANT", label: "식당" },
  { value: "STAY", label: "숙소" },
  { value: "ATTRACTION", label: "명소" },
  // 명소는 가서 보는 대상, 풍경은 그 자리에서 보이는 경치다. EXIF 좌표로
  // 기록하는 앱에서는 실제로 갈리는 축이다.
  { value: "SCENERY", label: "풍경" },
] as const satisfies readonly { value: PlaceCategory; label: string }[]

/**
 * enum 에 항목을 추가하고 위 목록에 라벨을 빠뜨리면 여기서 컴파일이 깨진다.
 * `satisfies` 는 그 반대 방향(enum 에 없는 값을 적는 실수)만 잡는다.
 */
type AssertNever<T extends never> = T
export type _CategoriesAreExhaustive = AssertNever<
  Exclude<PlaceCategory, (typeof CATEGORIES)[number]["value"]>
>

/**
 * 미선택이면 라벨이 없다. 예전에는 "기타" 로 폴백해서, 고른 적 없는
 * 카테고리가 카드에 라벨로 찍혔다.
 */
export function categoryLabel(value: PlaceCategory | null): string | null {
  return CATEGORIES.find((category) => category.value === value)?.label ?? null
}
