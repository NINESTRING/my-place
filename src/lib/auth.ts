import "server-only"

/**
 * 현재 사용자 id를 반환한다.
 *
 * 인증은 아직 구현되지 않았다. 원래 pages/api/graphql.ts가 Firebase Admin으로
 * ID 토큰을 검증해야 했으나 그 코드는 주석 처리되어 있었고 uid가 "1"로
 * 하드코딩되어 있었다. firebase-admin 패키지도 설치되지 않은 상태다.
 *
 * 이 함수가 인증을 붙일 유일한 지점이다. 실제 구현 시 여기서 세션 쿠키를
 * 검증하고 uid를 반환하도록 바꾸면 모든 쓰기 경로에 한 번에 적용된다.
 */
export async function getCurrentUserId(): Promise<string> {
  return "1"
}
