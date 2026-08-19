"use client"

import type { Place } from "@prisma/client"
import { XIcon } from "lucide-react"
import { PlaceCard } from "@/components/place-card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * 지도 위 왼쪽에서 밀려 들어오는 목록 패널.
 *
 * 지도를 덮지 않는 것이 요점이다. 그래서 화면을 가리는 백드롭도, 포커스
 * 트랩도 두지 않는다(그런 게 필요하면 Dialog 를 쓸 자리다). 패널이 열려
 * 있는 동안에도 지도는 그대로 잡고 끌 수 있어야 한다.
 *
 * 닫힘 상태에서는 화면 밖으로 밀어내기만 하므로 DOM 에 그대로 남는다.
 * 그래서 `inert` 로 탭 순서와 접근성 트리에서 빼 준다 — 없으면 보이지 않는
 * 카드들이 계속 탭 대상이 된다.
 */
export function PlaceListPanel({
  ref,
  open,
  places,
  selectedId,
  onSelect,
  onClose,
}: {
  ref?: React.Ref<HTMLElement>
  open: boolean
  places: Place[]
  selectedId: number | null
  onSelect: (place: Place) => void
  onClose: () => void
}) {
  return (
    <aside
      ref={ref}
      aria-label="장소 목록"
      inert={!open}
      className={cn(
        "bg-background/95 absolute inset-y-0 left-0 z-20 flex w-[min(22rem,82vw)] flex-col backdrop-blur transition-transform duration-300 ease-out",
        open ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      )}
    >
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
        <div className="flex items-baseline gap-2">
          <h2 className="font-heading text-base font-medium">다녀온 장소</h2>
          <span className="text-muted-foreground text-xs tabular-nums">
            {places.length}곳
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="목록 닫기"
        >
          <XIcon />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {places.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            이 영역에는 기록된 장소가 없습니다. 지도를 옮기거나 축소해 보세요.
          </p>
        ) : (
          <ul className="space-y-3">
            {places.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  onClick={() => onSelect(place)}
                  className={cn(
                    "focus-visible:ring-ring/50 block w-full rounded-xl text-left outline-none focus-visible:ring-3",
                    place.id === selectedId && "ring-primary ring-2"
                  )}
                >
                  <PlaceCard place={place} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
