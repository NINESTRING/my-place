import { describe, expect, it } from "vitest"
import { generateShareToken } from "@/lib/share-token"

describe("generateShareToken", () => {
  it("16바이트 난수의 base64url 표기라 22자다", () => {
    expect(generateShareToken()).toHaveLength(22)
  })

  it("URL 에 그대로 쓸 수 있는 문자만 쓴다", () => {
    // base64url 자모: A-Z a-z 0-9 - _  (+, /, = 없음)
    for (let i = 0; i < 20; i++) {
      expect(generateShareToken()).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })

  it("호출마다 다른 값을 돌려준다", () => {
    const tokens = new Set(
      Array.from({ length: 100 }, () => generateShareToken())
    )
    expect(tokens.size).toBe(100)
  })
})
