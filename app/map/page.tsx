import { MapView } from "@/components/map-view"
import { getPlacesInBounds } from "@/lib/places"
import type { Bounds } from "@/schemas/place"

// 홈과 같은 이유로 정적 프리렌더를 끈다.
export const dynamic = "force-dynamic"

const INITIAL_BOUNDS: Bounds = {
  sw: { latitude: 37, longitude: 126 },
  ne: { latitude: 38, longitude: 128 },
}

export default async function MapPage() {
  const places = await getPlacesInBounds(INITIAL_BOUNDS)

  return <MapView initialPlaces={places} initialBounds={INITIAL_BOUNDS} />
}
