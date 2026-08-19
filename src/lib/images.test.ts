import { afterEach, describe, expect, it, vi } from "vitest"
import { publicImageUrl, storageExtension } from "@/lib/images"

const SUPABASE_URL = "https://xhttvfbzqhprmentinxm.supabase.co"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("publicImageUrl", () => {
  it("storage path 를 places 버킷의 공개 URL 로 만든다", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL)
    expect(publicImageUrl("abc.jpg")).toBe(
      `${SUPABASE_URL}/storage/v1/object/public/places/abc.jpg`
    )
  })

  it("uuid 형식의 실제 경로를 그대로 이어 붙인다", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL)
    const path = "0f9c1a2b-3d4e-5f60-8a9b-1c2d3e4f5061.webp"
    expect(publicImageUrl(path)).toBe(
      `${SUPABASE_URL}/storage/v1/object/public/places/${path}`
    )
  })

  it("환경 변수에 후행 슬래시가 붙어도 이중 슬래시 없이 만든다", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `${SUPABASE_URL}/`)
    expect(publicImageUrl("abc.jpg")).toBe(
      `${SUPABASE_URL}/storage/v1/object/public/places/abc.jpg`
    )
  })
})

describe("storageExtension", () => {
  it("image/jpeg 를 jpg 로 바꾼다", () => {
    expect(storageExtension("image/jpeg")).toBe("jpg")
  })

  it("image/png 를 png 로 바꾼다", () => {
    expect(storageExtension("image/png")).toBe("png")
  })

  it("image/webp 를 webp 로 바꾼다", () => {
    expect(storageExtension("image/webp")).toBe("webp")
  })

  it("허용 목록에 없는 MIME 타입은 null 이다", () => {
    expect(storageExtension("image/heic")).toBeNull()
  })

  it("프로토타입 체인의 constructor 는 null 이다", () => {
    expect(storageExtension("constructor")).toBeNull()
  })

  it("프로토타입 체인의 __proto__ 는 null 이다", () => {
    expect(storageExtension("__proto__")).toBeNull()
  })

  it("프로토타입 체인의 toString 은 null 이다", () => {
    expect(storageExtension("toString")).toBeNull()
  })

  it("빈 문자열은 null 이다", () => {
    expect(storageExtension("")).toBeNull()
  })
})
