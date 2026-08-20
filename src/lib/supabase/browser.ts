import { createBrowserClient } from "@supabase/ssr"

/**
 * 브라우저에서 쓰는 Auth 전용 클라이언트.
 *
 * 이 앱에서 이 클라이언트의 유일한 용도는 signInWithOAuth 다. 장소 데이터는
 * Data API 가 아니라 서버(Prisma)를 통해서만 오가므로 여기서 DB 를 조회하는
 * 코드는 없어야 한다.
 *
 * publishable 키를 쓴다. 시크릿 키는 admin.ts 가 server-only 경계 안에서만
 * 다룬다. NEXT_PUBLIC_ 접두사가 붙은 값은 브라우저 번들에 그대로 들어가므로
 * 반드시 process.env.X 형태로 직접 참조해야 한다(변수에 담아 동적으로
 * 조회하면 치환되지 않아 undefined 가 된다 — images.ts 의 publicImageUrl 과
 * 같은 이유다).
 *
 * 매 호출마다 새로 만든다. createBrowserClient 는 내부적으로 같은 인스턴스를
 * 재사용하므로 이 함수를 여러 번 불러도 세션이 갈라지지 않는다.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
}
