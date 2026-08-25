"use client"

import {
  ListIcon,
  LogInIcon,
  MapPinPlusIcon,
  Share2Icon,
  XIcon,
  type LucideIcon,
} from "lucide-react"
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
 * 아이콘은 화면의 실제 버튼에 쓰인 것을 그대로 가져온다. 설명과 눌러야 할
 * 버튼이 눈으로 연결되므로, "오른쪽 위 세 번째 버튼" 같은 위치 설명을 쓰지
 * 않아도 된다. 버튼 구성이 바뀌면 여기도 같이 바뀌어야 한다.
 */
const STEPS: {
  icon: LucideIcon
  title: string
  body: React.ReactNode
}[] = [
  {
    icon: LogInIcon,
    title: "Google 계정으로 로그인",
    body: "처음이시면 자동으로 가입됩니다. 등록한 장소는 나에게만 보입니다.",
  },
  {
    icon: MapPinPlusIcon,
    title: "사진으로 장소 등록",
    body: (
      <>
        사진을 올리면 촬영 위치와 날짜를 읽어 지도에 핀을 꽂습니다.{" "}
        {/* 이 앱에서 등록이 막히는 경우는 사실상 이것 하나뿐이라, 안내가
            실제로 값을 하는 자리다. */}
        <span className="text-foreground font-medium">
          위치 정보가 없는 사진은 등록되지 않습니다.
        </span>
      </>
    ),
  },
  {
    icon: ListIcon,
    title: "지도와 목록으로 보기",
    body: "마커를 누르면 사진이 뜨고, 목록에서 고르면 그 장소로 지도가 이동합니다. 목록은 전체 / 지도 영역으로 범위를 고를 수 있습니다.",
  },
  {
    icon: Share2Icon,
    title: "카테고리와 공유",
    body: "등록 폼에서 카테고리를 직접 만들고, 관리 화면에서 카테고리별 공유 링크를 켤 수 있습니다.",
  },
]

/**
 * 사용법 안내 모달.
 *
 * 상태를 갖지 않는다 — 열림 여부도, "봤다" 표시도 전부 호출부가 가진다.
 * 이 앱의 다른 모달(LoginDialog·SignOutDialog)과 같은 계약이다.
 *
 * 단계를 슬라이드로 나누지 않은 것은 의도적이다. 네 개뿐이라 한 화면에 다
 * 들어가고, 급한 사람이 "다음"을 눌러 가며 끝까지 볼 이유가 없다.
 */
export function HelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 헤더는 고정하고 본문만 스크롤시킨다. 좁고 낮은 화면에서는 네 단계가
          뷰포트를 넘기는데, 팝업 자체를 스크롤시키면 제목과 닫기 버튼이 위로
          밀려 올라간다. 등록 모달과 같은 처리다. */}
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-sm"
      >
        <DialogHeader className="shrink-0 border-b p-4 pr-12">
          <DialogTitle>사용법 안내</DialogTitle>
          <DialogDescription>
            사진 한 장으로 다녀온 장소를 기록하고 지도에 모아 봅니다.
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

        <ol className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <span
                aria-hidden="true"
                className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full"
              >
                <Icon className="size-4" />
              </span>
              <div className="space-y-1">
                <p className="font-heading font-medium">{title}</p>
                <p className="text-muted-foreground text-sm">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  )
}
