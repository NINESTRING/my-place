import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * PKCE 흐름의 마지막 단계. Google → Supabase 를 거쳐 돌아온 authorization
 * code 를 세션으로 교환하고 원래 보던 화면으로 돌려보낸다.
 *
 * 세션 쿠키는 exchangeCodeForSession 이 lib/supabase/server.ts 의 setAll 을
 * 통해 쓴다. Route Handler 에서는 쿠키 쓰기가 허용되므로 그 경로가 실제로
 * 동작한다(서버 컴포넌트와 다른 점).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")

  // 열린 리다이렉트 방지. next 는 반드시 이 사이트 내부의 절대 경로여야
  // 한다. "//evil.com" 은 스킴 상대 URL 로 외부로 나가므로 함께 막는다.
  const requested = searchParams.get("next")
  const next =
    requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/"

  if (!code) {
    return NextResponse.redirect(new URL("/?auth_error=1", origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL("/?auth_error=1", origin))
  }

  return NextResponse.redirect(new URL(next, origin))
}
