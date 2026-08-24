import { randomBytes } from "node:crypto"

/**
 * 공유 링크 경로(/share/<token>)에 들어갈 토큰. 16바이트(128비트) 난수를
 * base64url 로 적어 22자 — URL 에 인코딩 없이 들어가고 추측이 불가능하다.
 *
 * 첫 공유 때 한 번 만들어 영구 보관한다. 공유를 껐다 켜도 링크가 바뀌지
 * 않는 것이 설계 결정이므로, 재발급이 필요해지기 전에는 다시 부를 일이 없다.
 */
export function generateShareToken(): string {
  return randomBytes(16).toString("base64url")
}
