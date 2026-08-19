import { describe, expect, it } from "vitest"
import { publicIdFromUrl } from "@/lib/places"

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
