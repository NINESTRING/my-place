import { describe, expect, it } from "vitest"
import { boundsQuerySchema, placeInputSchema } from "@/schemas/place"

// 저장 경로의 앞 세그먼트는 소유자(Supabase auth 사용자 UUID)다.
const OWNER = "11111111-2222-3333-4444-555555555555"
const OBJECT = "0f9c1a2b-3d4e-5f60-8a9b-1c2d3e4f5061"

const validInput = {
  title: "한강 야경",
  description: "다리 조명이 켜지는 시간에 갔다",
  image: `${OWNER}/${OBJECT}.jpg`,
  imageCreationTime: new Date("2026-01-01T00:00:00.000Z"),
  latitude: 37.65874,
  longitude: 126.97759,
  category: "RESTAURANT",
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

  it("제목이 비어 있으면 거부한다", () => {
    const result = placeInputSchema.safeParse({ ...validInput, title: "" })
    expect(result.success).toBe(false)
  })

  it("공백만 있는 제목은 거부한다", () => {
    // trim 전에 min(1)을 걸면 "   "가 통과해서, 카드·팝업·이미지 alt 에
    // 쓸 것이 없는 빈 제목이 저장된다.
    const result = placeInputSchema.safeParse({ ...validInput, title: "   " })
    expect(result.success).toBe(false)
  })

  it("제목이 60자를 넘으면 거부한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      title: "가".repeat(61),
    })
    expect(result.success).toBe(false)
  })

  it("제목이 정확히 60자면 통과한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      title: "가".repeat(60),
    })
    expect(result.success).toBe(true)
  })

  it("설명은 없어도 통과한다", () => {
    const { description: _omitted, ...withoutDescription } = validInput
    const result = placeInputSchema.safeParse(withoutDescription)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBeUndefined()
    }
  })

  it("공백만 있는 설명은 undefined 로 접는다", () => {
    // "" 와 null 이 DB 에 섞이면 "설명이 있는지" 판정이 두 갈래가 된다.
    // Prisma 는 undefined 를 "값 없음"으로 보고 nullable 컬럼에 NULL 을 넣는다.
    const result = placeInputSchema.safeParse({ ...validInput, description: "   " })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBeUndefined()
    }
  })

  it("빈 문자열 설명도 undefined 로 접는다", () => {
    // 손대지 않은 Textarea 는 ""를 보낸다 — 위 공백만 있는 경우와 별개로
    // 확인해 둔다.
    const result = placeInputSchema.safeParse({ ...validInput, description: "" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBeUndefined()
    }
  })

  it("설명 앞뒤 공백을 다듬는다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      description: "  다리 조명  ",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBe("다리 조명")
    }
  })

  it("설명이 500자를 넘으면 거부한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      description: "가".repeat(501),
    })
    expect(result.success).toBe(false)
  })

  it("설명이 정확히 500자면 통과한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      description: "가".repeat(500),
    })
    expect(result.success).toBe(true)
  })

  it("500자 본문에 앞뒤 공백이 붙어도 통과한다", () => {
    // trim 을 max 뒤에 두면 공백까지 글자 수에 들어가 501자가 되어 거부된다.
    // trim 이 먼저 실행되어야 정확히 500자로 남는다.
    const result = placeInputSchema.safeParse({
      ...validInput,
      description: `  ${"가".repeat(500)}\n`,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toHaveLength(500)
    }
  })

  it("정의된 카테고리를 통과시킨다", () => {
    expect(
      placeInputSchema.safeParse({ ...validInput, category: "SCENERY" }).success
    ).toBe(true)
  })

  it("카테고리 미선택(null)을 통과시킨다", () => {
    const result = placeInputSchema.safeParse({ ...validInput, category: null })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.category).toBeNull()
    }
  })

  it("enum 에 없는 카테고리를 거부한다", () => {
    // "기타" 는 두지 않는다. nullable 컬럼에 ETC 까지 있으면 "기타" 와
    // "미선택" 이 같은 말을 두 번 하게 된다.
    expect(
      placeInputSchema.safeParse({ ...validInput, category: "ETC" }).success
    ).toBe(false)
  })

  it("옛 정수 카테고리 코드를 거부한다", () => {
    expect(
      placeInputSchema.safeParse({ ...validInput, category: 2 }).success
    ).toBe(false)
  })

  it("소유자 폴더가 붙은 storage path 를 통과시킨다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      image: `${OWNER}/${OBJECT}.webp`,
    })
    expect(result.success).toBe(true)
  })

  it("png 확장자를 통과시킨다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      image: `${OWNER}/${OBJECT}.png`,
    })
    expect(result.success).toBe(true)
  })

  it("소유자 폴더가 없는 옛 형식을 거부한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      image: `${OBJECT}.jpg`,
    })
    expect(result.success).toBe(false)
  })

  it("소유자 폴더가 uuid 가 아니면 거부한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      image: `sub/${OBJECT}.jpg`,
    })
    expect(result.success).toBe(false)
  })

  it("세그먼트가 셋 이상인 경로를 거부한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      image: `${OWNER}/${OWNER}/${OBJECT}.jpg`,
    })
    expect(result.success).toBe(false)
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
      image: `${OWNER}/${OBJECT}.heic`,
    })
    expect(result.success).toBe(false)
  })

  it("uuid 형식이 아닌 파일명을 거부한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      image: `${OWNER}/not-a-uuid.jpg`,
    })
    expect(result.success).toBe(false)
  })

  it("경로 이탈 시도를 거부한다", () => {
    const result = placeInputSchema.safeParse({
      ...validInput,
      image: `${OWNER}/../../etc/passwd.jpg`,
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
