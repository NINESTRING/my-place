import { describe, expect, it } from "vitest"
import {
  categoryIdSchema,
  categoryNameSchema,
  categoryUpdateSchema,
  categorySharingSchema,
} from "@/schemas/category"

describe("categoryNameSchema", () => {
  it("보통 이름을 통과시킨다", () => {
    const result = categoryNameSchema.safeParse("전시")
    expect(result.success).toBe(true)
  })

  it("앞뒤 공백을 다듬는다", () => {
    const result = categoryNameSchema.safeParse("  전시  ")
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe("전시")
    }
  })

  it("빈 이름을 거부한다", () => {
    expect(categoryNameSchema.safeParse("").success).toBe(false)
  })

  it("공백만 있는 이름을 거부한다", () => {
    // trim 이 min 앞이어야 한다. 뒤면 "   "가 통과해 보이지 않는 카테고리가
    // 생긴다.
    expect(categoryNameSchema.safeParse("   ").success).toBe(false)
  })

  it("20자를 넘는 이름을 거부한다", () => {
    expect(categoryNameSchema.safeParse("가".repeat(21)).success).toBe(false)
  })

  it("정확히 20자면 통과한다", () => {
    expect(categoryNameSchema.safeParse("가".repeat(20)).success).toBe(true)
  })
})

describe("categoryIdSchema", () => {
  it("양의 정수를 통과시킨다", () => {
    expect(categoryIdSchema.safeParse(3).success).toBe(true)
  })

  it("0과 음수를 거부한다", () => {
    expect(categoryIdSchema.safeParse(0).success).toBe(false)
    expect(categoryIdSchema.safeParse(-1).success).toBe(false)
  })

  it("숫자 문자열을 거부한다", () => {
    // 액션 인자는 클라이언트가 보낸 값이다. 강제 변환을 걸면 null·""가 0
    // 으로 접혀 들어온다 — placeIdSchema 와 같은 이유다.
    expect(categoryIdSchema.safeParse("3").success).toBe(false)
  })
})

describe("categoryUpdateSchema", () => {
  it("id 와 이름을 함께 받는다", () => {
    const result = categoryUpdateSchema.safeParse({ id: 1, name: " 전시 " })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ id: 1, name: "전시" })
    }
  })

  it("이름 규칙은 생성과 같다 — 빈 이름을 거부한다", () => {
    expect(categoryUpdateSchema.safeParse({ id: 1, name: "  " }).success).toBe(
      false
    )
  })

  it("id 가 없으면 거부한다", () => {
    expect(categoryUpdateSchema.safeParse({ name: "전시" }).success).toBe(false)
  })
})

describe("categorySharingSchema", () => {
  it("id 와 enabled 를 받는다", () => {
    expect(
      categorySharingSchema.safeParse({ id: 3, enabled: true }).success
    ).toBe(true)
    expect(
      categorySharingSchema.safeParse({ id: 3, enabled: false }).success
    ).toBe(true)
  })

  it("enabled 는 진짜 불리언만 받는다 — 문자열 'true' 는 거부", () => {
    expect(
      categorySharingSchema.safeParse({ id: 3, enabled: "true" }).success
    ).toBe(false)
  })

  it("id 규칙은 다른 액션과 같다 — 0·음수·소수 거부", () => {
    expect(
      categorySharingSchema.safeParse({ id: 0, enabled: true }).success
    ).toBe(false)
    expect(
      categorySharingSchema.safeParse({ id: -1, enabled: true }).success
    ).toBe(false)
    expect(
      categorySharingSchema.safeParse({ id: 1.5, enabled: true }).success
    ).toBe(false)
  })
})
