import { AuthErrorToast } from "@/components/auth-error-toast"
import { PlaceExplorer } from "@/components/place-explorer"
import { getCurrentUserId } from "@/lib/auth"
import { getPlacesInBounds } from "@/lib/places.server"
import type { Bounds } from "@/schemas/place"

// 지도에 보이는 장소는 매 요청마다 최신 DB 상태를 반영해야 하므로 정적
// 프리렌더를 명시적으로 끈다. 이 설정이 없으면 next build 가 빌드 시점에 이
// 페이지를 정적으로 생성하려고 시도하며, 그 과정에서 Prisma 가 DB 에 연결을
// 시도한다(이 환경처럼 DATABASE_URL 이 없으면 빌드 자체가 실패한다).
export const dynamic = "force-dynamic"

// 첫 화면에 그릴 범위. 클라이언트는 마운트 직후 localStorage 에 저장된 마지막
// 위치로 다시 조회하므로, 여기서는 수도권 전체를 덮는 넉넉한 값이면 된다.
const INITIAL_BOUNDS: Bounds = {
  sw: { latitude: 37, longitude: 126 },
  ne: { latitude: 38, longitude: 128 },
}

export default async function HomePage() {
  // 로그인하지 않았으면 조회 자체를 하지 않는다. 이 앱의 장소는 등록한
  // 사람에게만 보이므로 미인증 사용자에게는 마커 없는 지도가 정상 화면이다.
  const userId = await getCurrentUserId()
  const places = userId ? await getPlacesInBounds(INITIAL_BOUNDS, userId) : []

  return (
    <main>
      <h1 className="sr-only">my-place — 다녀온 장소 지도</h1>
      <AuthErrorToast />
      <PlaceExplorer
        initialPlaces={places}
        initialBounds={INITIAL_BOUNDS}
        isAuthenticated={userId !== null}
      />
    </main>
  )
}
