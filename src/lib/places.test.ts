import { describe, expect, it } from "vitest"
import { boundsAround, revivePlace, type SerializedPlace } from "@/lib/places"

describe("revivePlace", () => {
  const serialized: SerializedPlace = {
    id: 1,
    userId: "1",
    image: "0f9c1a2b-3d4e-5f60-8a9b-1c2d3e4f5061.jpg",
    imageCreationTime: "2026-01-01T00:00:00.000Z",
    latitude: 37.65874,
    longitude: 126.97759,
    title: "한강 야경",
    description: "다리 조명이 켜지는 시간에 갔다",
    category: "RESTAURANT",
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
    expect(result.title).toBe(serialized.title)
    expect(result.description).toBe(serialized.description)
    expect(result.category).toBe(serialized.category)
  })
})

describe("boundsAround", () => {
  it("지점을 가운데 두는 상자를 만든다", () => {
    const bounds = boundsAround({ latitude: 37.5, longitude: 127 })
    expect(bounds).toEqual({
      sw: { latitude: 37.45, longitude: 126.95 },
      ne: { latitude: 37.55, longitude: 127.05 },
    })
  })

  it("극지방에서 위도를 -90..90 안으로 자른다", () => {
    const north = boundsAround({ latitude: 89.98, longitude: 0 })
    expect(north.ne.latitude).toBe(90)

    const south = boundsAround({ latitude: -89.98, longitude: 0 })
    expect(south.sw.latitude).toBe(-90)
  })
})
