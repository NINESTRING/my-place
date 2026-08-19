import { describe, expect, it } from "vitest"
import { boundsQuerySchema, placeInputSchema } from "@/schemas/place"

const validInput = {
  description: "한강 야경",
  image: "0f9c1a2b-3d4e-5f60-8a9b-1c2d3e4f5061.jpg",
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

  it("uuid 형식의 storage path 를 통과시킨다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      image: "0f9c1a2b-3d4e-5f60-8a9b-1c2d3e4f5061.webp",
    })
    expect(result.success).toBe(true)
  })

  it("png 확장자를 통과시킨다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      image: "0f9c1a2b-3d4e-5f60-8a9b-1c2d3e4f5061.png",
    })
    expect(result.success).toBe(true)
  })

  it("전체 URL 을 image 로 거부한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      image:
        "https://xhttvfbzqhprmentinxm.supabase.co/storage/v1/object/public/places/a.jpg",
    })
    expect(result.success).toBe(false)
  })

  it("허용하지 않는 확장자를 거부한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      image: "0f9c1a2b-3d4e-5f60-8a9b-1c2d3e4f5061.heic",
    })
    expect(result.success).toBe(false)
  })

  it("uuid 형식이 아닌 파일명을 거부한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      image: "not-a-uuid.jpg",
    })
    expect(result.success).toBe(false)
  })

  it("경로 이탈 시도를 거부한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      image: "../../etc/passwd.jpg",
    })
    expect(result.success).toBe(false)
  })

  it("하위 폴더를 포함한 경로를 거부한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      image: "sub/0f9c1a2b-3d4e-5f60-8a9b-1c2d3e4f5061.jpg",
    })
    expect(result.success).toBe(false)
  })

  it("빈 문자열을 image 로 거부한다", () => {
    const result = placeInputSchema.safeParse({ ...validInput, image: "" })
    expect(result.success).toBe(false)
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

  it("URLSearchParams.get()이 반환하는 null을 거부한다", () => {
    // request.nextUrl.searchParams.get()은 파라미터가 없으면 null을 반환한다.
    // z.coerce.number()는 Number(null) === 0 이라 null을 0으로 강제해 버리므로
    // 누락된 파라미터가 유효한 0으로 통과하지 않는지 확인한다.
    const result = boundsQuerySchema.safeParse({
      swLat: null,
      swLng: "126.0",
      neLat: "38.0",
      neLng: "128.0",
    })
    expect(result.success).toBe(false)
  })

  it("빈 문자열을 거부한다", () => {
    const result = boundsQuerySchema.safeParse({
      swLat: "",
      swLng: "126.0",
      neLat: "38.0",
      neLng: "128.0",
    })
    expect(result.success).toBe(false)
  })

  it("네 파라미터 모두 null이면 거부한다", () => {
    const result = boundsQuerySchema.safeParse({
      swLat: null,
      swLng: null,
      neLat: null,
      neLng: null,
    })
    expect(result.success).toBe(false)
  })

  it("네 파라미터가 유효한 숫자 문자열이면 통과하고 숫자로 강제한다", () => {
    const result = boundsQuerySchema.safeParse({
      swLat: "37.0",
      swLng: "126.0",
      neLat: "38.0",
      neLng: "128.0",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sw.latitude).toBe(37)
      expect(result.data.sw.longitude).toBe(126)
      expect(result.data.ne.latitude).toBe(38)
      expect(result.data.ne.longitude).toBe(128)
    }
  })

  it("위도가 범위를 벗어난 숫자 문자열이면 거부한다", () => {
    const result = boundsQuerySchema.safeParse({
      swLat: "91",
      swLng: "126.0",
      neLat: "38.0",
      neLng: "128.0",
    })
    expect(result.success).toBe(false)
  })

  it("경도가 범위를 벗어난 숫자 문자열이면 거부한다", () => {
    const result = boundsQuerySchema.safeParse({
      swLat: "37.0",
      swLng: "126.0",
      neLat: "38.0",
      neLng: "181",
    })
    expect(result.success).toBe(false)
  })
})
