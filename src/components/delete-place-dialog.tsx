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
 * 삭제 확인 모달.
 *
 * 되돌릴 수 없는 동작이라 한 번 묻는다 — 행만이 아니라 Storage 의 사진까지
 * 지우므로 실행취소를 제공하려면 soft delete 와 정리 작업이 따라온다.
 *
 * 기본 포커스를 취소에 두려고 취소를 DOM 앞에 놓는다. DialogFooter 가
 * flex-col-reverse(모바일) / sm:flex-row(데스크톱) 이라 취소가 데스크톱에서는
 * 왼쪽, 모바일에서는 아래에 온다. SignOutDialog 와 같은 배치다.
 */
export function DeletePlaceDialog({
  open,
  title,
  onOpenChange,
  onConfirm,
  pending,
}: {
  open: boolean
  title: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  pending: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>장소를 삭제할까요?</DialogTitle>
          <DialogDescription>
            &lsquo;{title}&rsquo; 을(를) 지웁니다. 올린 사진도 함께 지워지며
            되돌릴 수 없습니다.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />} disabled={pending}>
            취소
          </DialogClose>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? "삭제 중…" : "삭제"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
