"use client"

import "mapbox-gl/dist/mapbox-gl.css"

import Image from "next/image"
import { useEffect, useState } from "react"
import Map, {
  Marker,
  Popup,
  type ViewStateChangeEvent,
} from "react-map-gl/mapbox"
import { useDebounce } from "use-debounce"
import { useLastData } from "@/hooks/use-last-data"
import { useLocalState } from "@/hooks/use-local-state"
import type { PlaceWithPublicId } from "@/lib/places"
import type { Bounds } from "@/schemas/place"

type Viewport = { latitude: number; longitude: number; zoom: number }

const DEFAULT_VIEWPORT: Viewport = {
  latitude: 37.65874,
  longitude: 126.97759,
  zoom: 10,
}

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
  initialPlaces: PlaceWithPublicId[]
  initialBounds: Bounds
}) {
  const [selected, setSelected] = useState<PlaceWithPublicId | null>(null)
  const [viewport, setViewport] = useLocalState<Viewport>(
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
  const [places, setPlaces] = useState<PlaceWithPublicId[] | null>(
    initialPlaces
  )
  const shownPlaces = useLastData(places) ?? []

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const res = await fetch(`/api/places?${toQuery(debouncedBounds)}`, {
          signal: controller.signal,
        })
        if (!res.ok) return
        const json = (await res.json()) as { places: PlaceWithPublicId[] }
        setPlaces(
          json.places.map((p) => ({
            ...p,
            imageCreationTime: new Date(p.imageCreationTime),
          }))
        )
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

  return (
    <div className="h-[calc(100dvh-3.5rem)] w-full">
      <Map
        initialViewState={viewport}
        onMoveEnd={onMoveEnd}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_API_TOKEN}
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
                  src={selected.publicId}
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
