import { describe, expect, it } from "vitest"
import { PlaceCategory } from "@/generated/prisma/enums"
import { CATEGORIES, categoryLabel, toCategory } from "@/lib/categories"

describe("CATEGORIES", () => {
  it("enum 의 모든 항목에 라벨이 있다", () => {
    // 이 테스트는 타입 단정(_CategoriesAreExhaustive)의 런타임 짝이다.
    // 항목을 추가하고 라벨을 빠뜨리면 컴파일과 테스트가 함께 깨진다.
    const labelled = CATEGORIES.map((category) => category.value)
    expect(labelled.toSorted()).toEqual(Object.values(PlaceCategory).toSorted())
  })

  it("풍경을 포함한다", () => {
    expect(CATEGORIES.some((c) => c.value === "SCENERY")).toBe(true)
  })
})

describe("categoryLabel", () => {
  it("enum 값을 한국어 라벨로 바꾼다", () => {
    expect(categoryLabel("SCENERY")).toBe("풍경")
    expect(categoryLabel("CAFE")).toBe("카페")
  })

  it("미선택이면 null 을 돌려준다", () => {
    // 예전에는 "기타" 로 폴백해서, 고른 적 없는 카테고리가 카드에 라벨로
    // 찍혔다. 호출자가 자리를 비울 수 있어야 한다.
    expect(categoryLabel(null)).toBeNull()
  })
})

describe("toCategory", () => {
  it("빈 배열이면 해제(null)로 본다", () => {
    // ToggleGroup 은 눌린 항목을 다시 누르면 빈 배열을 준다 — 이것이 해제다.
    expect(toCategory([])).toBeNull()
  })

  it("정의된 카테고리 배열을 그 값으로 좁힌다", () => {
    expect(toCategory(["SCENERY"])).toBe("SCENERY")
  })

  it("enum 에 없는 값은 null 로 본다", () => {
    expect(toCategory(["ETC"])).toBeNull()
  })
})
