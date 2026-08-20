import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * 요청 쿠키에 묶인 서버 클라이언트. 세션을 읽고(auth.ts), PKCE 코드를
 * 교환하고(app/auth/callback), 로그아웃한다(actions/auth.ts).
 *
 * admin.ts 와 달리 publishable 키를 쓰는 것이 요점이다. 인증 판단은 사용자의
 * JWT 로 해야 한다. 시크릿 키 클라이언트는 RLS 를 우회하는 관리자 권한이라
 * "이 요청을 보낸 사람이 누구인가"에 답할 수 없다.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없어 cookies().set() 이 throw
          // 한다. 토큰 갱신은 proxy.ts 가 매 요청마다 담당하므로 여기서
          // 실패하는 것은 정상이며 무시해도 된다. 반대로 Route Handler 나
          // 서버 액션에서 부를 때는 이 경로가 실제로 쿠키를 써야 하므로
          // try 를 지우면 안 된다.
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // 서버 컴포넌트 렌더 중. proxy.ts 가 갱신을 대신한다.
          }
        },
      },
    }
  )
}
