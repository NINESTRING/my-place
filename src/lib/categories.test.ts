import { describe, expect, it } from "vitest"
import {
  categoryNames,
  filterByCategories,
  sortCategories,
  toCategoryIds,
  withCategory,
  withoutCategory,
  withRenamedCategory,
} from "@/lib/categories"

describe("sortCategories", () => {
  it("이름순으로 정렬한 새 배열을 돌려준다", () => {
    const input = [
      { id: 1, name: "풍경" },
      { id: 2, name: "카페" },
      { id: 3, name: "명소" },
    ]
    expect(sortCategories(input).map((c) => c.name)).toEqual([
      "명소",
      "카페",
      "풍경",
    ])
    // 원본은 그대로다. 정렬이 제자리(in-place)면 React state 로 들고 있는
    // 배열이 조용히 바뀐다.
    expect(input[0].name).toBe("풍경")
  })
})

describe("toCategoryIds", () => {
  it("ToggleGroup 의 문자열 값을 숫자 id 로 바꾼다", () => {
    expect(toCategoryIds(["3", "1"])).toEqual([3, 1])
  })

  it("빈 배열이면 전부 해제로 본다", () => {
    expect(toCategoryIds([])).toEqual([])
  })

  it("정수 id 로 읽히지 않는 값은 버린다", () => {
    expect(toCategoryIds(["abc", "1.5", "-2", "0", "7"])).toEqual([7])
  })
})

describe("withCategory", () => {
  const list = [
    { id: 1, name: "명소" },
    { id: 2, name: "카페" },
  ]

  it("새 카테고리를 이름순 자리에 넣는다", () => {
    expect(withCategory(list, { id: 3, name: "산책" })).toEqual([
      { id: 1, name: "명소" },
      { id: 3, name: "산책" },
      { id: 2, name: "카페" },
    ])
  })

  it("이미 있는 id 는 중복으로 넣지 않는다", () => {
    // 서버 생성이 멱등이라 같은 이름을 다시 만들면 기존 행이 돌아온다.
    expect(withCategory(list, { id: 2, name: "카페" })).toEqual(list)
  })
})

describe("withRenamedCategory", () => {
  it("같은 id 의 이름을 바꾸고 정렬 위치를 다시 잡는다", () => {
    const list = [
      { id: 1, name: "명소" },
      { id: 2, name: "카페" },
    ]
    expect(withRenamedCategory(list, { id: 1, name: "휴양지" })).toEqual([
      { id: 2, name: "카페" },
      { id: 1, name: "휴양지" },
    ])
  })
})

describe("filterByCategories", () => {
  const places = [
    { id: 1, categories: [{ id: 10 }, { id: 20 }] },
    { id: 2, categories: [{ id: 20 }] },
    { id: 3, categories: [] },
  ]

  it("빈 선택은 필터 없음이다 — 전부 남는다", () => {
    expect(filterByCategories(places, [])).toEqual(places)
  })

  it("고른 카테고리를 가진 장소만 남는다", () => {
    expect(filterByCategories(places, [10]).map((p) => p.id)).toEqual([1])
  })

  it("여러 개를 고르면 OR 다 — 하나라도 가지면 남는다", () => {
    expect(filterByCategories(places, [10, 20]).map((p) => p.id)).toEqual([
      1, 2,
    ])
  })

  it("카테고리 없는 장소는 필터가 켜지면 빠진다", () => {
    expect(filterByCategories(places, [20]).map((p) => p.id)).toEqual([1, 2])
  })

  it("아무 장소도 갖지 않은 id 면 빈 목록이다", () => {
    expect(filterByCategories(places, [99])).toEqual([])
  })
})

describe("withoutCategory", () => {
  it("해당 id 만 뺀다", () => {
    const list = [
      { id: 1, name: "명소" },
      { id: 2, name: "카페" },
    ]
    expect(withoutCategory(list, 1)).toEqual([{ id: 2, name: "카페" }])
  })

  it("없는 id 면 그대로다", () => {
    const list = [{ id: 1, name: "명소" }]
    expect(withoutCategory(list, 9)).toEqual(list)
  })
})

describe("categoryNames", () => {
  it("이름들을 가운뎃점으로 잇는다", () => {
    expect(
      categoryNames([
        { id: 1, name: "카페" },
        { id: 2, name: "풍경" },
      ])
    ).toBe("카페 · 풍경")
  })

  it("하나도 없으면 null 을 돌려준다", () => {
    // 빈 문자열이면 호출자가 자리를 비울 수 없다(옛 categoryLabel 과 같은 규칙).
    expect(categoryNames([])).toBeNull()
  })
})
