"use client"

import { MoreVerticalIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * 목록 카드의 케밥 메뉴. 수정과 삭제로 가는 입구다.
 *
 * hover 로 나타나게 하지 않고 항상 띄운다. 이 앱은 사진을 찍은 자리에서
 * 폰으로 보는 쪽이 주 사용처인데, 거기에는 hover 가 없다.
 *
 * 사진 위에 올라가므로 밝은 사진에서도 읽혀야 한다. 반투명 배경과 블러로
 * 아래 사진과 분리한다.
 */
export function PlaceCardMenu({
  title,
  onDelete,
}: {
  title: string
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            // size-8. 사진 위에 뜨는 유일한 조작점이라 손가락으로도 눌려야 한다.
            size="icon"
            // 카드가 여러 장 쌓이므로 어느 장소의 메뉴인지까지 읽어 준다.
            aria-label={`${title} 메뉴`}
            className="bg-background/70 hover:bg-background/90 rounded-full backdrop-blur-sm"
          />
        }
      >
        <MoreVerticalIcon />
      </DropdownMenuTrigger>

      {/* 기본 팝업 폭이 트리거 폭(w-(--anchor-width))을 따라가는데 트리거가
          아이콘 버튼이라 너무 좁다. 내용에 맞춘다. */}
      <DropdownMenuContent align="end" className="w-auto">
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2Icon />
          삭제
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
