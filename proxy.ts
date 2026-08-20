import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Next 16 에서 middleware.ts 는 proxy.ts 로 이름이 바뀌었다
 * (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
 * middleware.md 가 deprecated 로 명시). 기능은 동일하다.
 *
 * 이 파일의 역할은 **세션 토큰 갱신 하나뿐**이다. 서버 컴포넌트는 쿠키를
 * 쓸 수 없어 갱신된 토큰을 저장할 수 없으므로(lib/supabase/server.ts 의
 * setAll 주석 참고) 매 요청 앞단에서 여기가 대신 해 준다.
 *
 * Supabase 공식 예제의 proxy 는 미인증 사용자를 /login 으로 리다이렉트하지만
 * 그 부분은 의도적으로 넣지 않았다. 이 앱은 로그인하지 않아도 지도를 볼 수
 * 있어야 하고, 로그인은 별도 라우트가 아니라 모달이다. 인가는 리다이렉트가
 * 아니라 데이터 소스에 가까운 곳(lib/auth.ts, actions/place.ts)에서 한다 —
 * Next 인증 가이드도 proxy 를 유일한 방어선으로 쓰지 말라고 지시한다.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Fluid compute 환경에서 요청 간에 클라이언트가 공유되면 세션이 섞인다.
  // 매 요청마다 새로 만든다.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
          // 인증 쿠키를 싣는 응답은 CDN·리버스 프록시가 캐시하면 안 된다.
          // 한 사용자의 세션 토큰이 다른 사용자에게 서빙될 수 있다.
          // 라이브러리가 그에 맞는 Cache-Control 등을 여기로 넘겨 준다.
          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value)
          })
        },
      },
    }
  )

  // createServerClient 와 getClaims() 사이에 코드를 넣지 말 것. 사용자가
  // 무작위로 로그아웃되는, 원인을 찾기 매우 어려운 버그의 출처다.
  await supabase.auth.getClaims()

  // supabaseResponse 를 그대로 반환해야 한다. 새 NextResponse 를 만들면
  // 위에서 실은 쿠키가 유실되고 브라우저와 서버의 세션이 어긋나 세션이
  // 조용히 끊긴다.
  return supabaseResponse
}

export const config = {
  matcher: [
    // 정적 자산과 이미지는 세션 갱신이 필요 없다. 지도 타일·사진처럼 요청이
    // 잦은 경로에서 JWT 검증을 반복하지 않도록 제외한다.
    "/((?!_next/static|_next/image|favicon.ico|maplibre/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mjs)$).*)",
  ],
}
