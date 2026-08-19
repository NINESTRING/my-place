import { PlaceCard } from "@/components/place-card"
import { getAllPlaces } from "@/lib/places"

// 장소 목록은 매 요청마다 최신 DB 상태를 반영해야 하므로 정적 프리렌더를
// 명시적으로 끈다. 이 설정이 없으면 next build가 빌드 시점에 이 페이지를
// 정적으로 생성하려고 시도하며, 그 과정에서 Prisma가 DB에 연결을 시도한다
// (이 환경처럼 DATABASE_URL이 없으면 빌드 자체가 실패한다).
export const dynamic = "force-dynamic"

export default async function HomePage() {
  const places = await getAllPlaces()

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">다녀온 장소</h1>

      {places.length === 0 ? (
        <p className="text-muted-foreground">
          아직 기록된 장소가 없습니다. 사진을 올려 첫 장소를 남겨 보세요.
        </p>
      ) : (
        <ul className="space-y-4">
          {places.map((place) => (
            <li key={place.id}>
              <PlaceCard place={place} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
