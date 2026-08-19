import { describe, expect, it } from "vitest"
import { boundsQuerySchema, placeInputSchema } from "@/schemas/place"

const validInput = {
  description: "한강 야경",
  image: "https://res.cloudinary.com/demo/image/upload/v1/a.jpg",
  imageCreationTime: new Date("2026-01-01T00:00:00.000Z"),
  latitude: 37.65874,
  longitude: 126.97759,
  rating: 4,
  category: 2,
}

describe("placeInputSchema", () => {
  it("올바른 입력을 통과시킨다", () => {
    const result = placeInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it("위도가 90을 넘으면 거부한다", () => {
    const result = placeInputSchema.safeParse({ ...validInput, latitude: 90.1 })
    expect(result.success).toBe(false)
  })

  it("경도가 -180 미만이면 거부한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      longitude: -180.1,
    })
    expect(result.success).toBe(false)
  })

  it("설명이 비어 있으면 거부한다", () => {
    const result = placeInputSchema.safeParse({ ...validInput, description: "" })
    expect(result.success).toBe(false)
  })

  it("별점이 범위를 벗어나면 거부한다", () => {
    expect(placeInputSchema.safeParse({ ...validInput, rating: 0 }).success).toBe(
      false
    )
    expect(placeInputSchema.safeParse({ ...validInput, rating: 6 }).success).toBe(
      false
    )
  })

  it("카테고리가 범위를 벗어나면 거부한다", () => {
    expect(
      placeInputSchema.safeParse({ ...validInput, category: 5 }).success
    ).toBe(false)
  })

  it("ISO 문자열 날짜를 Date로 강제한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      imageCreationTime: "2026-01-01T00:00:00.000Z",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.imageCreationTime).toBeInstanceOf(Date)
    }
  })
})

describe("boundsQuerySchema", () => {
  it("쿼리 문자열을 숫자 bounds로 강제한다", () => {
    const result = boundsQuerySchema.safeParse({
      swLat: "37.0",
      swLng: "126.0",
      neLat: "38.0",
      neLng: "128.0",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sw.latitude).toBe(37)
      expect(result.data.ne.longitude).toBe(128)
    }
  })

  it("숫자가 아닌 값을 거부한다", () => {
    const result = boundsQuerySchema.safeParse({
      swLat: "abc",
      swLng: "126.0",
      neLat: "38.0",
      neLng: "128.0",
    })
    expect(result.success).toBe(false)
  })

  it("값이 누락되면 거부한다", () => {
    const result = boundsQuerySchema.safeParse({ swLat: "37.0" })
    expect(result.success).toBe(false)
  })
})
