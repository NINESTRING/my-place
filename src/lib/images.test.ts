import { afterEach, describe, expect, it, vi } from "vitest"
import { publicImageUrl } from "@/lib/images"

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
})
