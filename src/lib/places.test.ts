import { describe, expect, it } from "vitest"
import { publicIdFromUrl, revivePlace, type SerializedPlace } from "@/lib/places"

describe("publicIdFromUrl", () => {
  it("Cloudinary secure_url의 마지막 세그먼트를 반환한다", () => {
    const url =
      "https://res.cloudinary.com/demo/image/upload/v1667000000/abc123.jpg"
    expect(publicIdFromUrl(url)).toBe("abc123.jpg")
  })

  it("세그먼트가 하나뿐이면 그 값을 그대로 반환한다", () => {
    expect(publicIdFromUrl("abc123.jpg")).toBe("abc123.jpg")
  })

  it("빈 문자열이면 빈 문자열을 반환한다", () => {
    expect(publicIdFromUrl("")).toBe("")
  })

  it("끝에 슬래시가 있으면 빈 문자열을 반환한다", () => {
    expect(publicIdFromUrl("https://res.cloudinary.com/demo/")).toBe("")
  })
})

describe("revivePlace", () => {
  const serialized: SerializedPlace = {
    id: 1,
    userId: "1",
    image: "https://res.cloudinary.com/demo/image/upload/v1/abc123.jpg",
    imageCreationTime: "2026-01-01T00:00:00.000Z",
    latitude: 37.65874,
    longitude: 126.97759,
    description: "한강 야경",
    rating: 4,
    category: 2,
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-03T00:00:00.000Z",
    publicId: "abc123.jpg",
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
    expect(result.publicId).toBe(serialized.publicId)
  })
})
