/**
 * Supabase Storage public 버킷의 객체 경로를 공개 URL 로 만든다.
 *
 * DB 의 image 컬럼에는 전체 URL 이 아니라 경로(`<uuid>.jpg`)만 저장한다.
 * 프로젝트 ref 가 데이터에 박히지 않으므로 프로젝트를 옮겨도 행을 고치지
 * 않아도 된다.
 *
 * process.env.NEXT_PUBLIC_SUPABASE_URL 은 Next 가 빌드 시점에 문자열로
 * 치환하므로 반드시 이 형태로 직접 참조해야 한다. 변수에 담아 동적으로
 * 조회하면 클라이언트 번들에서 undefined 가 된다.
 */
export function publicImageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/places/${path}`
}
