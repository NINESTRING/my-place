import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PlaceExplorer } from "@/components/place-explorer"
import { boundsOf, FALLBACK_BOUNDS } from "@/lib/places"
import { getSharedPlaces } from "@/lib/share.server"

// 홈과 같은 이유로 정적 프리렌더를 끈다 — 매 요청이 공유 상태의 최신을
// 반영해야 하고, 빌드 시점에는 DB 도 토큰도 없다.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "공유된 장소 — my-place",
  // 링크를 아는 사람만 보는 페이지다. 검색엔진이 토큰 URL 을 수집해 두면
  // 공유를 꺼도 캐시된 목록이 남는다.
  robots: { index: false, follow: false },
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // 없는 토큰과 공유가 꺼진 토큰은 같은 404 다 — 존재 여부를 새지 않게
  // 하는 것은 수정·삭제 액션과 같은 원칙이다.
  const shared = await getSharedPlaces(token)
  if (!shared) notFound()

  return (
    <main>
      <h1 className="sr-only">{shared.name} — 공유된 장소 지도</h1>
      <PlaceExplorer
        share={{ categoryName: shared.name }}
        initialPlaces={shared.places}
        initialBounds={boundsOf(shared.places) ?? FALLBACK_BOUNDS}
        initialCenter={null}
        initialCategories={[]}
        isAuthenticated={false}
      />
    </main>
  )
}
