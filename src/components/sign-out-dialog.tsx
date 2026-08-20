"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * 로그아웃 확인 모달.
 *
 * 로그아웃 자체는 되돌릴 수 있는 동작이지만(다시 로그인하면 된다) 되돌리는
 * 비용이 크다 — Google 로 나갔다 돌아오는 왕복이고, 그 사이 지도 뷰포트는
 * localStorage 에 남아도 열려 있던 목록 패널과 선택 상태는 사라진다. 우상단에
 * 등록·목록 버튼과 나란히 붙어 있어 오클릭도 쉽다.
 *
 * window.confirm 을 쓰지 않은 이유는 이 앱의 다른 모든 확인 흐름이 모달이고
 * (등록·로그인) 브라우저 기본 대화상자는 스타일이 어긋나기 때문이다.
 *
 * 기본 포커스를 취소에 두려고 취소를 뒤에 놓지 않고 앞에 둔다. DialogFooter 가
 * flex-col-reverse(모바일) / sm:flex-row(데스크톱) 이므로, DOM 순서상 앞에
 * 있는 취소가 데스크톱에서는 왼쪽, 모바일에서는 아래에 온다.
 */
export function SignOutDialog({
  open,
  onOpenChange,
  onConfirm,
  pending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  pending: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>로그아웃할까요?</DialogTitle>
          <DialogDescription>
            로그아웃하면 지도에서 내 장소가 보이지 않습니다. 다시 로그인하면
            그대로 다시 나타납니다.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />} disabled={pending}>
            취소
          </DialogClose>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? "로그아웃 중…" : "로그아웃"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
