"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

/**
 * 로그아웃. 세션 쿠키를 지우고 화면을 다시 그린다.
 *
 * 서버 액션에서 하는 이유는 쿠키 삭제가 서버에서 일어나야 하기 때문이다.
 * 브라우저 클라이언트로 signOut() 을 부르면 localStorage 쪽만 정리되고
 * 서버가 읽는 httpOnly 쿠키는 남아, 화면은 로그아웃인데 서버는 로그인으로
 * 보는 상태가 된다.
 *
 * revalidatePath 로 "/" 를 무효화해야 서버 컴포넌트가 다시 실행되면서 장소
 * 목록이 빈 배열로 바뀐다.
 */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/")
}
