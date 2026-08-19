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
import Image from "next/image"
import { useEffect, useState } from "react"
import Map, {
  Marker,
  Popup,
  type ViewStateChangeEvent,
} from "react-map-gl/maplibre"
import { useDebounce } from "use-debounce"
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

// 헤더(Task 6)와 같은 --header-height 변수를 공유한다.
const MAP_HEIGHT_CLASS = "h-[calc(100dvh-var(--header-height))] w-full"

function toQuery(bounds: Bounds): string {
  return new URLSearchParams({
    swLat: String(bounds.sw.latitude),
    swLng: String(bounds.sw.longitude),
    neLat: String(bounds.ne.latitude),
    neLng: String(bounds.ne.longitude),
  }).toString()
}

export function MapView({
  initialPlaces,
  initialBounds,
}: {
  initialPlaces: Place[]
  initialBounds: Bounds
}) {
  const [selected, setSelected] = useState<Place | null>(null)
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
  }, [debouncedBounds])

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

  // Map의 initialViewState는 마운트 시점에 한 번만 적용되고 이후로는
  // 다시 읽지 않는다(react-map-gl v8, node_modules/@vis.gl/react-maplibre
  // 내부 _initialize/_updateViewState 참고). 자식(Map)의 마운트 effect는
  // 부모인 이 컴포넌트의 effect(=localStorage 읽기)보다 먼저 실행되므로,
  // hydrated 이전에 Map을 마운트하면 항상 DEFAULT_VIEWPORT로 굳어져
  // 저장된 위치로 복원되지 않는다. hydrated가 될 때까지 같은 크기의
  // 빈 자리만 렌더링해 Map 마운트를 미룬다. 서버와 첫 클라이언트 렌더는
  // 항상 이 분기를 타므로 하이드레이션 불일치도 생기지 않는다.
  if (!viewportHydrated) {
    return <div className={MAP_HEIGHT_CLASS} />
  }

  return (
    <div className={MAP_HEIGHT_CLASS}>
      <Map
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
    </div>
  )
}
