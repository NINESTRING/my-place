/**
 * Supabase Storage public 버킷의 객체 경로를 공개 URL 로 만든다.
 *
 * DB 의 image 컬럼에는 전체 URL 이 아니라 경로(`<uuid>.jpg`)만 저장한다.
 * 프로젝트 ref 가 데이터에 박히지 않으므로 프로젝트를 옮겨도 행을 고치지
 * 않아도 된다.
 *
 * process.env.NEXT_PUBLIC_SUPABASE_URL 은 Next 가 빌드 시점에 문자열로
 * 치환하므로 반드시 이 형태로 직접 참조해야 한다. 변수에 담아 동적으로
 * 조회하면 클라이언트 번들에서 undefined 가 된다. 뒤에 이어 붙는 `.replace()`는
 * 치환된 문자열 위에서 동작하므로 안전하다 — 후행 슬래시가 있으면
 * `next.config.ts` 의 remotePatterns 매칭이 조용히 실패해 이미지가 전부
 * 깨지므로 여기서 제거해 둔다.
 */
export function publicImageUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "")
  return `${base}/storage/v1/object/public/places/${path}`
}

/** Storage 버킷 places 의 file_size_limit(바이트). 버킷 설정과 값을 맞춰 둔다. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

const EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
])

/**
 * 허용 MIME 타입을 저장 확장자로 바꾼다. 허용 목록에 없으면 null.
 *
 * Map 을 쓰는 것이 요점이다. 객체 리터럴 조회는 프로토타입 체인을 타므로
 * "constructor" 같은 값이 truthy 를 반환해 허용 목록 검사를 통과한다.
 */
export function storageExtension(contentType: string): string | null {
  return EXTENSIONS.get(contentType) ?? null
}
