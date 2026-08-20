"use client"

import { XIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/browser"

/**
 * 로그인 모달이 열린 이유. 사용자가 무엇을 하려다 막혔는지에 따라 설명이
 * 달라진다. null 은 로그인 버튼을 직접 누른 경우다.
 */
export type LoginReason = "create" | "list" | null

const DESCRIPTIONS: Record<"create" | "list", string> = {
  create: "장소를 등록하려면 로그인이 필요합니다.",
  list: "내 장소 목록을 보려면 로그인이 필요합니다.",
}

const DEFAULT_DESCRIPTION =
  "로그인하면 다녀온 장소를 사진으로 기록하고 지도에 모아 볼 수 있습니다."

/** Google 브랜드 가이드가 요구하는 4색 G 마크. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}

/**
 * 로그인 모달.
 *
 * 이 앱은 화면이 하나뿐이므로(dcc18b3) 로그인도 별도 라우트가 아니라
 * 모달이다. 리다이렉트가 없어 지도의 위치·확대 수준이 그대로 유지되고,
 * 미인증 사용자가 지도를 계속 볼 수 있다는 요구사항과도 맞는다.
 *
 * Google OAuth 에서는 회원가입과 로그인이 같은 동작이다. 버튼을 두 개 두면
 * 라벨만 다르고 하는 일이 같아 오해를 부르므로, 버튼 하나에 "처음이면 가입"
 * 이라는 설명을 붙였다.
 */
export function LoginDialog({
  open,
  onOpenChange,
  reason,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  reason: LoginReason
}) {
  const [pending, setPending] = useState(false)

  const signIn = async () => {
    setPending(true)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // 브라우저에서 부르는 이유가 여기 있다. origin 을 서버에서는 알 수
        // 없고(로컬·프리뷰·운영이 다 다르다), 이 URL 은 Supabase 대시보드의
        // Redirect URLs 허용 목록과 일치해야 한다.
        redirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    })

    // 성공하면 브라우저가 Google 로 이동하므로 이 뒤 코드는 실행되지 않는다.
    // data.url 이 비어 있으면 이동이 일어나지 않았다는 뜻이라 함께 걸러 준다.
    if (error || !data?.url) {
      setPending(false)
      toast.error("로그인을 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-0 p-0 sm:max-w-sm">
        <DialogHeader className="border-b p-4 pr-12">
          <DialogTitle>로그인</DialogTitle>
          <DialogDescription>
            {reason ? DESCRIPTIONS[reason] : DEFAULT_DESCRIPTION}
          </DialogDescription>
        </DialogHeader>

        <DialogClose
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-3 right-3"
            />
          }
        >
          <XIcon />
          <span className="sr-only">닫기</span>
        </DialogClose>

        <div className="space-y-3 p-4">
          <Button
            variant="outline"
            size="lg"
            onClick={signIn}
            disabled={pending}
            className="w-full"
          >
            <GoogleMark />
            {pending ? "Google 로 이동 중…" : "Google 계정으로 계속하기"}
          </Button>

          <p className="text-muted-foreground text-center text-xs">
            처음이시면 자동으로 가입됩니다. 등록한 장소는 나에게만 보입니다.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
