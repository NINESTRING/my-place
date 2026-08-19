import { describe, expect, it } from "vitest"
import {
  clampRating,
  revivePlace,
  type SerializedPlace,
} from "@/lib/places"

describe("clampRating", () => {
  it("-1 을 0 으로 고정한다", () => {
    expect(clampRating(-1)).toBe(0)
  })

  it("0 은 그대로 0 을 반환한다", () => {
    expect(clampRating(0)).toBe(0)
  })

  it("3 은 범위 안이므로 그대로 반환한다", () => {
    expect(clampRating(3)).toBe(3)
  })

  it("5 는 그대로 5 를 반환한다", () => {
    expect(clampRating(5)).toBe(5)
  })

  it("1000 처럼 상한을 넘는 값은 5 로 고정한다", () => {
    expect(clampRating(1000)).toBe(5)
  })

  it("2.5 처럼 정수가 아닌 값은 반올림하지 않고 그대로 반환한다", () => {
    expect(clampRating(2.5)).toBe(2.5)
  })
})

describe("revivePlace", () => {
  const serialized: SerializedPlace = {
    id: 1,
    userId: "1",
    image: "0f9c1a2b-3d4e-5f60-8a9b-1c2d3e4f5061.jpg",
    imageCreationTime: "2026-01-01T00:00:00.000Z",
    latitude: 37.65874,
    longitude: 126.97759,
    description: "한강 야경",
    rating: 4,
    category: 2,
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-03T00:00:00.000Z",
  }

  it("imageCreationTime, createdAt, updatedAt을 Date 인스턴스로 되돌린다", () => {
    const result = revivePlace(serialized)
    expect(result.imageCreationTime).toBeInstanceOf(Date)
    expect(result.createdAt).toBeInstanceOf(Date)
    expect(result.updatedAt).toBeInstanceOf(Date)
    expect(result.imageCreationTime.toISOString()).toBe(
      "2026-01-01T00:00:00.000Z"
    )
    expect(result.createdAt.toISOString()).toBe("2026-01-02T00:00:00.000Z")
    expect(result.updatedAt.toISOString()).toBe("2026-01-03T00:00:00.000Z")
  })

  it("그 외 필드는 값을 그대로 유지한다", () => {
    const result = revivePlace(serialized)
    expect(result.id).toBe(serialized.id)
    expect(result.userId).toBe(serialized.userId)
    expect(result.image).toBe(serialized.image)
    expect(result.latitude).toBe(serialized.latitude)
    expect(result.longitude).toBe(serialized.longitude)
    expect(result.description).toBe(serialized.description)
    expect(result.rating).toBe(serialized.rating)
    expect(result.category).toBe(serialized.category)
  })
})
