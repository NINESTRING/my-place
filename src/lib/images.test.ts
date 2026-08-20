import { afterEach, describe, expect, it, vi } from "vitest"
import {
  isOwnedImagePath,
  publicImageUrl,
  storageExtension,
  userScopedImagePath,
} from "@/lib/images"

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

const OWNER = "11111111-2222-3333-4444-555555555555"
const OTHER = "99999999-8888-7777-6666-555555555555"

describe("userScopedImagePath", () => {
  it("소유자 폴더 아래에 uuid 파일명을 만든다", () => {
    const path = userScopedImagePath(OWNER, "jpg")
    expect(path).toMatch(
      new RegExp(
        `^${OWNER}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.jpg$`
      )
    )
  })

  it("호출마다 다른 경로를 만든다", () => {
    expect(userScopedImagePath(OWNER, "jpg")).not.toBe(
      userScopedImagePath(OWNER, "jpg")
    )
  })

  it("만들어 낸 경로는 자기 소유로 판정된다", () => {
    expect(isOwnedImagePath(userScopedImagePath(OWNER, "webp"), OWNER)).toBe(
      true
    )
  })
})

describe("isOwnedImagePath", () => {
  it("자기 폴더의 경로를 통과시킨다", () => {
    expect(isOwnedImagePath(`${OWNER}/abc.jpg`, OWNER)).toBe(true)
  })

  it("남의 폴더의 경로를 거부한다", () => {
    expect(isOwnedImagePath(`${OTHER}/abc.jpg`, OWNER)).toBe(false)
  })

  it("접두사만 같은 폴더를 거부한다", () => {
    expect(isOwnedImagePath("abcd/x.jpg", "abc")).toBe(false)
  })

  it("소유자 폴더가 없는 경로를 거부한다", () => {
    expect(isOwnedImagePath("abc.jpg", OWNER)).toBe(false)
  })

  it("하위 폴더를 더 판 경로를 거부한다", () => {
    expect(isOwnedImagePath(`${OWNER}/sub/abc.jpg`, OWNER)).toBe(false)
  })

  it("파일명이 빈 경로를 거부한다", () => {
    expect(isOwnedImagePath(`${OWNER}/`, OWNER)).toBe(false)
  })

  it("경로 이탈로 남의 폴더를 노리는 시도를 거부한다", () => {
    expect(isOwnedImagePath(`${OWNER}/../${OTHER}/abc.jpg`, OWNER)).toBe(false)
  })

  it("userId 가 빈 문자열이면 거부한다", () => {
    expect(isOwnedImagePath("/abc.jpg", "")).toBe(false)
  })
})
