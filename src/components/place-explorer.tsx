"use client"

// maplibre-gl 은 5.x 에 고정한다. 6.x 는 워커 URL 을 import.meta.url 에서
// 유도하고 그 값이 http(s) URL 이 아니면 빈 문자열을 반환하는데(dist/
// maplibre-gl.mjs 의 워커 URL 헬퍼 참고), Turbopack 이 번들한 청크에서는
// http URL 이 아니라서 워커 URL 이 ""가 되고 현재 문서 경로로 해석된다.
// 그러면 dev 서버가 HTML 을 돌려주어 "Failed to load module script: ...
// non-JavaScript MIME type of text/html" 로 워커가 죽고, 타일 fetch·파싱이
// 전부 워커에서 일어나므로 스타일과 스프라이트만 200 으로 로드된 채 지도가
// 빈 화면이 된다. 예외도 안 나므로 조용히 실패한다.
// 5.x 는 워커를 인라인 Blob 으로 만들어 번들러에 무관하게 동작한다.
// src/lib/deps.test.ts 가 실수로 6.x 로 올라가는 것을 막는다.
import "maplibre-gl/dist/maplibre-gl.css"

import type { Place } from "@prisma/client"
import { ListIcon, MapPinPlusIcon } from "lucide-react"
import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"
import Map, {
  Marker,
  Popup,
  type MapRef,
  type ViewStateChangeEvent,
} from "react-map-gl/maplibre"
import { useDebounce } from "use-debounce"
import { CreatePlaceDialog } from "@/components/create-place-dialog"
import { PlaceListPanel } from "@/components/place-list-panel"
import { Button } from "@/components/ui/button"
import { useLastData } from "@/hooks/use-last-data"
import { useLocalState } from "@/hooks/use-local-state"
import { publicImageUrl } from "@/lib/images"
import { revivePlace, type SerializedPlace } from "@/lib/places"
import type { Bounds } from "@/schemas/place"

type Viewport = { latitude: number; longitude: number; zoom: number }

const DEFAULT_VIEWPORT: Viewport = {
  latitude: 37.65874,
  longitude: 126.97759,
  zoom: 10,
}

// 앱 전체가 이 한 화면이므로 지도가 뷰포트를 그대로 채운다. 목록 패널과 조작
// 버튼은 이 컨테이너를 기준으로 절대 배치되므로 relative 가 필요하다.
const SHELL_CLASS = "relative h-dvh w-full overflow-hidden"

// 목록에서 장소를 고를 때 최소한 이 정도까지는 확대한다.
const FOCUS_ZOOM = 14

function toQuery(bounds: Bounds): string {
  return new URLSearchParams({
    swLat: String(bounds.sw.latitude),
    swLng: String(bounds.sw.longitude),
    neLat: String(bounds.ne.latitude),
    neLng: String(bounds.ne.longitude),
  }).toString()
}

export function PlaceExplorer({
  initialPlaces,
  initialBounds,
}: {
  initialPlaces: Place[]
  initialBounds: Bounds
}) {
  const mapRef = useRef<MapRef>(null)
  const panelRef = useRef<HTMLElement>(null)
  const [selected, setSelected] = useState<Place | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [viewport, setViewport, viewportHydrated] = useLocalState<Viewport>(
    "viewport",
    DEFAULT_VIEWPORT
  )
  const [bounds, setBounds] = useLocalState<Bounds>("bounds", initialBounds)

  // 옛 버전은 bounds 를 "[[lng,lat],[lng,lat]]" 문자열로 저장했다.
  // 형식이 맞지 않으면 초기값으로 되돌린다.
  useEffect(() => {
    const malformed =
      typeof bounds?.sw?.latitude !== "number" ||
      typeof bounds?.ne?.latitude !== "number"
    if (malformed) {
      setBounds(initialBounds)
    }
  }, [bounds, initialBounds, setBounds])

  const [debouncedBounds] = useDebounce(bounds, 1000)
  const [places, setPlaces] = useState<Place[] | null>(initialPlaces)
  const shownPlaces = useLastData(places) ?? []

  // 저장 직후처럼 bounds 는 그대로인데 서버 데이터만 바뀐 경우를 위한 값이다.
  // 이 화면의 장소 목록은 RSC 가 아니라 /api/places 로 가져오므로
  // router.refresh() 로는 갱신되지 않는다.
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const res = await fetch(`/api/places?${toQuery(debouncedBounds)}`, {
          signal: controller.signal,
        })
        if (!res.ok) return
        const json = (await res.json()) as { places: SerializedPlace[] }
        setPlaces(json.places.map(revivePlace))
      } catch {
        // 중단되었거나 네트워크 오류. 이전 데이터를 유지한다.
      }
    }

    void load()
    return () => controller.abort()
  }, [debouncedBounds, reloadToken])

  const onMoveEnd = (e: ViewStateChangeEvent) => {
    const b = e.target.getBounds()
    if (b) {
      setBounds({
        sw: { latitude: b.getSouth(), longitude: b.getWest() },
        ne: { latitude: b.getNorth(), longitude: b.getEast() },
      })
    }
    setViewport({
      latitude: e.viewState.latitude,
      longitude: e.viewState.longitude,
      zoom: e.viewState.zoom,
    })
  }

  const flyTo = useCallback(
    (target: { latitude: number; longitude: number }) => {
      const map = mapRef.current
      if (!map) return

      // 목록 패널이 열려 있으면 지도의 왼쪽 일부가 가려진다. 목표 지점을 패널
      // 너비의 절반만큼 오른쪽으로 밀어서 "보이는 영역"의 가운데에 오게 한다.
      // padding 옵션과 달리 offset 은 이 애니메이션에만 적용되므로 이후
      // getBounds() 계산에 잔여 효과가 남지 않는다.
      const hidden = listOpen ? (panelRef.current?.offsetWidth ?? 0) : 0

      map.flyTo({
        center: [target.longitude, target.latitude],
        zoom: Math.max(map.getZoom(), FOCUS_ZOOM),
        offset: [hidden / 2, 0],
        duration: 800,
      })
    },
    [listOpen]
  )

  const onSelectFromList = (place: Place) => {
    setSelected(place)
    flyTo(place)
  }

  const onCreated = (place: { latitude: number; longitude: number }) => {
    setCreateOpen(false)
    // 새 장소가 지금 보이는 영역 밖일 수도 있고, 안이라면 bounds 가 바뀌지 않아
    // 재조회가 걸리지 않는다. 두 경우 모두 커버하려고 토큰을 올린다.
    setReloadToken((n) => n + 1)
    flyTo(place)
  }

  return (
    <div className={SHELL_CLASS}>
      {/* Map의 initialViewState는 마운트 시점에 한 번만 적용되고 이후로는
          다시 읽지 않는다(react-map-gl v8, node_modules/@vis.gl/react-maplibre
          내부 _initialize/_updateViewState 참고). 자식(Map)의 마운트 effect는
          부모인 이 컴포넌트의 effect(=localStorage 읽기)보다 먼저 실행되므로,
          hydrated 이전에 Map을 마운트하면 항상 DEFAULT_VIEWPORT로 굳어져
          저장된 위치로 복원되지 않는다. hydrated가 될 때까지 같은 크기의
          빈 자리만 렌더링해 Map 마운트를 미룬다. 서버와 첫 클라이언트 렌더는
          항상 이 분기를 타므로 하이드레이션 불일치도 생기지 않는다. */}
      {viewportHydrated ? (
        <Map
          ref={mapRef}
          initialViewState={viewport}
          onMoveEnd={onMoveEnd}
          mapStyle="https://tiles.openfreemap.org/styles/liberty"
          style={{ width: "100%", height: "100%" }}
        >
          {shownPlaces.map((place) => (
            <Marker
              key={place.id}
              latitude={place.latitude}
              longitude={place.longitude}
              color="#ef4444"
              onClick={() => setSelected(place)}
            />
          ))}

          {selected && (
            <Popup
              latitude={selected.latitude}
              longitude={selected.longitude}
              onClose={() => setSelected(null)}
              closeOnClick={false}
              maxWidth="260px"
            >
              <div className="space-y-2">
                <p className="font-medium">{selected.description}</p>
                <div className="relative aspect-square w-full overflow-hidden rounded">
                  <Image
                    src={publicImageUrl(selected.image)}
                    alt={selected.description}
                    fill
                    sizes="260px"
                    className="object-cover"
                  />
                </div>
              </div>
            </Popup>
          )}
        </Map>
      ) : (
        <div className="bg-muted h-full w-full" />
      )}

      {/* 조작 버튼은 오른쪽 위 모서리에 둔다. 목록 패널은 왼쪽에서 나오므로
          열려 있어도 버튼을 가리지 않고, 지도 저작권 표시(오른쪽 아래)와도
          겹치지 않는다. */}
      <div className="absolute top-4 right-4 z-30 flex flex-col gap-2">
        <Button
          onClick={() => setCreateOpen(true)}
          aria-label="장소 등록"
          className="size-11 rounded-full shadow-lg"
        >
          <MapPinPlusIcon className="size-5" />
        </Button>
        <Button
          variant="outline"
          onClick={() => setListOpen((open) => !open)}
          aria-label="장소 목록"
          aria-pressed={listOpen}
          className="size-11 rounded-full shadow-lg"
        >
          <ListIcon className="size-5" />
        </Button>
      </div>

      <PlaceListPanel
        ref={panelRef}
        open={listOpen}
        places={shownPlaces}
        selectedId={selected?.id ?? null}
        onSelect={onSelectFromList}
        onClose={() => setListOpen(false)}
      />

      <CreatePlaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={onCreated}
      />
    </div>
  )
}
