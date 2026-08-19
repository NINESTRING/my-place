"use client"

import { XIcon } from "lucide-react"
import { PlaceForm } from "@/components/place-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * 등록 폼을 담는 모달.
 *
 * 목록 패널과 달리 여기서는 모달이 맞다. 폼을 채우는 동안 지도를 만질 이유가
 * 없고, 폼 안에 촬영 위치를 보여 주는 지도가 따로 뜨기 때문이다.
 *
 * 닫히면 팝업이 언마운트되므로 폼 상태(선택한 파일·EXIF·미리보기)도 함께
 * 사라진다. 저장 성공 후 다시 열었을 때 이전 입력이 남지 않는 것은 이 덕분이다.
 */
export function CreatePlaceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (place: { latitude: number; longitude: number }) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 헤더는 고정하고 본문만 스크롤시킨다. 사진을 고르면 폼 안에 지도가
          추가로 나타나 세로로 길어지므로 팝업 자체를 스크롤시키면 제목과
          닫기 버튼이 위로 밀려 올라간다. */}
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-lg"
      >
        <DialogHeader className="shrink-0 border-b p-4 pr-12">
          <DialogTitle>장소 등록</DialogTitle>
          <DialogDescription>
            위치 정보가 담긴 사진을 올리면 촬영한 자리에 장소를 기록합니다.
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

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <PlaceForm onCreated={onCreated} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
