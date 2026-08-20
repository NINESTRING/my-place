"use client"

import type { Place } from "@/generated/prisma/client"
import { XIcon } from "lucide-react"
import { PlaceCard } from "@/components/place-card"
import { PlaceCardMenu } from "@/components/place-card-menu"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

/**
 * 목록이 보여 줄 범위.
 *
 * `all` 이 기본이다. 지도가 담지 못하는 것 — 예전에 다녀왔지만 지금 화면
 * 밖인 장소 — 을 찾으러 목록을 여는 것이 보통이기 때문이다. `map` 은 지도에
 * 찍힌 마커와 정확히 같은 배열을 받는다.
 */
export type PlaceListScope = "all" | "map"

const SCOPE_LABEL: Record<PlaceListScope, string> = {
  all: "전체",
  map: "지도 영역",
}

/** ToggleGroup 래퍼는 제네릭이 아니라 값이 string 으로 넓어져서 나온다. */
function isScope(value: string | undefined): value is PlaceListScope {
  return value === "all" || value === "map"
}

const EMPTY_MESSAGE: Record<PlaceListScope, string> = {
  all: "아직 등록한 장소가 없습니다. 오른쪽 위 등록 버튼으로 첫 장소를 남겨 보세요.",
  map: "이 영역에는 기록된 장소가 없습니다. 지도를 옮기거나 축소해 보세요.",
}

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
 *
 * `places` 가 null 이면 아직 못 불러온 상태다. 빈 배열과 갈라 두지 않으면
 * 조회가 도는 동안 "등록한 장소가 없습니다"가 잘못 뜬다.
 */
export function PlaceListPanel({
  ref,
  open,
  places,
  scope,
  onScopeChange,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onClose,
}: {
  ref?: React.Ref<HTMLElement>
  open: boolean
  places: Place[] | null
  scope: PlaceListScope
  onScopeChange: (scope: PlaceListScope) => void
  selectedId: number | null
  onSelect: (place: Place) => void
  onEdit: (place: Place) => void
  onDelete: (place: Place) => void
  onClose: () => void
}) {
  return (
    <aside
      ref={ref}
      aria-label="장소 목록"
      inert={!open}
      className={cn(
        // 폰에서는 패널이 화면을 거의 다 덮으면 "지도를 덮지 않는다"는
        // 전제가 무너진다. 좁은 화면에서만 폭을 더 줄여 지도가 옆에 남게 한다.
        "bg-background/95 absolute inset-y-0 left-0 z-20 flex w-[min(22rem,70vw)] flex-col backdrop-blur transition-transform duration-300 ease-out",
        open ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      )}
    >
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
        <div className="flex items-baseline gap-2">
          <h2 className="font-heading text-base font-medium">다녀온 장소</h2>
          {places && (
            <span className="text-muted-foreground text-xs tabular-nums">
              {places.length}곳
            </span>
          )}
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

      <div className="shrink-0 border-b px-4 py-2">
        <ToggleGroup
          aria-label="목록 범위"
          variant="outline"
          size="sm"
          spacing={0}
          value={[scope]}
          // 눌린 항목을 다시 누르면 base-ui 가 빈 배열을 준다. 세그먼트
          // 컨트롤에서 "아무것도 선택되지 않음"은 보여 줄 목록이 없다는
          // 뜻이므로, 값이 비면 지금 범위를 그대로 둔다.
          onValueChange={([value]) => {
            if (isScope(value)) onScopeChange(value)
          }}
        >
          {(Object.keys(SCOPE_LABEL) as PlaceListScope[]).map((value) => (
            <ToggleGroupItem key={value} value={value}>
              {SCOPE_LABEL[value]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {places === null ? (
          <p className="text-muted-foreground text-sm">
            목록을 불러오는 중입니다.
          </p>
        ) : places.length === 0 ? (
          <p className="text-muted-foreground text-sm">{EMPTY_MESSAGE[scope]}</p>
        ) : (
          <ul className="space-y-3">
            {places.map((place) => (
              <li key={place.id} className="relative">
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

                {/* 메뉴를 카드 버튼 *안* 에 넣으면 버튼 중첩이라 마크업이
                    무효가 되고, 메뉴를 여는 클릭이 바깥 버튼으로 새어 나가
                    지도가 함께 날아간다. 형제로 두고 위치만 겹친다.

                    폰에서는 카드가 가로로 눕고 오른쪽 위가 날짜 줄이므로,
                    사진 위(왼쪽 위)로 옮긴다. 좁은 화면에서 글자와 자리를
                    다투지 않게 하려는 것이다. */}
                <div className="absolute top-2 left-2 sm:right-2 sm:left-auto">
                  <PlaceCardMenu
                    title={place.title}
                    onEdit={() => onEdit(place)}
                    onDelete={() => onDelete(place)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
