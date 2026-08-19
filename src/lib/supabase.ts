import "server-only"

import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY

if (!url || !secretKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SECRET_KEY 가 필요합니다"
  )
}

/**
 * 시크릿 키를 쓰는 서버 전용 클라이언트. RLS 를 우회하므로 절대 클라이언트
 * 컴포넌트로 내보내지 않는다. server-only import 가 그 사고를 컴파일 시점에
 * 막아 준다.
 *
 * 인증을 쓰지 않으므로 세션 저장과 토큰 갱신을 끈다. 서버에서는 요청마다
 * 상태가 없어야 한다.
 */
export const supabaseAdmin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export const PLACES_BUCKET = "places"
