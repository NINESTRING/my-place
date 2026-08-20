import "server-only"

import { cache } from "react"
import { createClient } from "@/lib/supabase/server"

/**
 * 현재 사용자 id, 로그인하지 않았으면 null.
 *
 * 이 앱의 인증은 전부 이 함수 하나를 거친다. 반환값은 Supabase auth 의
 * 사용자 UUID 이고 Place.userId 에 그대로 들어간다.
 *
 * 반환형에 null 이 있는 것이 안전장치다. 호출부는 "로그인 안 된 경우"를
 * 처리하지 않으면 컴파일되지 않는다. 예전 스텁이 고정값 "1" 을 돌려주던
 * 시절에는 그 분기가 존재하지 않았으므로, 타입이 바뀌면서 타입 체커가 모든
 * 호출부를 다시 보게 만든다.
 *
 * getClaims() 를 쓰는 것이 중요하다. getSession() 은 쿠키에 담긴 값을 그대로
 * 돌려주므로 위조를 걸러내지 못한다. getClaims() 는 JWT 서명을 검증하며
 * (비대칭 키면 WebCrypto 로 로컬 검증, 대칭 키면 서버 왕복) 만료가 임박하면
 * 세션을 먼저 갱신한다.
 *
 * React cache() 로 감싸 한 번의 렌더 패스에서 여러 번 불러도 검증이 한 번만
 * 일어나게 한다. 페이지가 세션을 확인하고 그 안의 액션이 다시 확인하는
 * 패턴이 자연스럽게 나오기 때문이다.
 *
 * 인가 판단에 app_metadata / user_metadata 를 쓰지 않는다. user_metadata 는
 * 사용자가 직접 수정할 수 있어 신뢰할 수 없고, 이 앱에는 역할 개념이 없어
 * sub 하나로 충분하다.
 */
export const getCurrentUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims?.sub) {
    return null
  }

  return data.claims.sub
})
