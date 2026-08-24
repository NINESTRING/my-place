/**
 * 카테고리는 사용자가 직접 만드는 행(Category)이며, 화면 대부분은 id 와
 * name 만 필요하다. Prisma 모델 전체(createdAt 등)를 끌고 다니지 않도록
 * 이 축약형을 경계 타입으로 쓴다.
 */
export type CategorySummary = { id: number; name: string }

/**
 * 화면에 보이는 카테고리 순서는 어디서나 이름순 하나다. 서버 조회, 클라이언트
 * 목록 append 후, 카드 라벨이 각자 정렬하면 결국 서로 어긋난다.
 */
export function sortCategories<T extends { name: string }>(
  categories: readonly T[]
): T[] {
  return [...categories].toSorted((a, b) => a.name.localeCompare(b.name, "ko"))
}

/**
 * ToggleGroup 은 값을 문자열 배열로 주고받는데 카테고리 식별자는 숫자 id 다.
 * 정수로 읽히지 않는 값은 조용히 버린다 — 배열에 남는 것은 항상 실제 항목의
 * value 에서 왔으므로, 걸러지는 경우는 코드 버그뿐이다.
 */
export function toCategoryIds(next: readonly string[]): number[] {
  return next
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0)
}

/**
 * 목록에 카테고리를 넣는다. 이미 있으면(서버의 멱등 생성이 기존 행을 돌려준
 * 경우) 그대로 둔다. 아래 두 헬퍼와 함께, 서버 액션 성공 후 클라이언트가
 * 들고 있는 선택지 목록을 재조회 없이 같은 상태로 옮기는 데 쓴다.
 */
export function withCategory(
  categories: readonly CategorySummary[],
  category: CategorySummary
): CategorySummary[] {
  if (categories.some((c) => c.id === category.id)) return [...categories]
  return sortCategories([...categories, category])
}

/** 같은 id 의 이름을 바꾼다. 이름이 바뀌면 정렬 위치도 다시 잡는다. */
export function withRenamedCategory(
  categories: readonly CategorySummary[],
  category: CategorySummary
): CategorySummary[] {
  return sortCategories(
    categories.map((c) => (c.id === category.id ? category : c))
  )
}

/**
 * 목록 패널의 카테고리 필터. 빈 선택은 "필터 없음"이다 — 칩을 다 꺼서
 * 목록이 통째로 사라지는 것은 아무도 의도하지 않는다.
 *
 * 여러 개를 고르면 OR 다. 교집합(AND)은 다중 카테고리 장소가 드문 개인
 * 기록에서 대부분 빈 목록만 만든다.
 */
export function filterByCategories<
  T extends { categories: readonly { id: number }[] },
>(places: readonly T[], categoryIds: readonly number[]): T[] {
  if (categoryIds.length === 0) return [...places]
  return places.filter((place) =>
    place.categories.some((category) => categoryIds.includes(category.id))
  )
}

/** 목록에서 뺀다. 폼 값(categoryIds)에서 빼는 것은 호출자의 몫이다. */
export function withoutCategory(
  categories: readonly CategorySummary[],
  id: number
): CategorySummary[] {
  return categories.filter((c) => c.id !== id)
}

/**
 * 카드에 찍을 한 줄 라벨. 하나도 없으면 null 을 돌려준다 — 빈 문자열을 주면
 * 호출자가 자리를 비울 수 없다(옛 categoryLabel 과 같은 규칙).
 */
export function categoryNames(
  categories: readonly CategorySummary[]
): string | null {
  if (categories.length === 0) return null
  return categories.map((category) => category.name).join(" · ")
}
