"use client"

import { useEffect } from "react"
import { toast } from "sonner"

/**
 * /auth/callback 이 코드 교환에 실패하면 `/?auth_error=1` 로 돌려보낸다.
 * 그 표시를 토스트로 바꾸고 주소창을 정리한다.
 *
 * 전용 에러 페이지를 만들지 않은 이유는 이 앱이 한 화면 구조이고 Toaster 가
 * 이미 레이아웃에 있기 때문이다. 실패해도 사용자는 지도를 계속 볼 수 있는
 * 상태이므로 화면을 갈아치울 이유가 없다.
 *
 * replaceState 로 쿼리를 지우는 것은 새로고침할 때 같은 토스트가 다시 뜨는
 * 것을 막기 위한 것이다. router.replace 를 쓰면 RSC 재요청이 따라붙는데
 * 여기서는 주소만 정리하면 된다.
 */
export function AuthErrorToast() {
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has("auth_error")) return

    toast.error("로그인에 실패했습니다. 다시 시도해 주세요.")

    url.searchParams.delete("auth_error")
    window.history.replaceState(null, "", url.toString())
  }, [])

  return null
}
