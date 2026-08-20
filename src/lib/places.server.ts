import "server-only"

import type { Place } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import type { Bounds } from "@/schemas/place"

const MAX_PLACES = 50

/**
 * 지도에 보이는 영역에서 **이 사용자가 등록한** 장소. 마커와 목록 패널이 이
 * 한 번의 조회를 함께 쓰므로, 목록에 그대로 쓸 수 있도록 최신 촬영 순으로
 * 정렬해 돌려준다.
 *
 * userId 를 옵셔널이 아니라 필수 인자로 받는 것이 의도적이다. 기본값이나
 * 옵셔널이면 필터를 빼먹은 호출이 조용히 통과해 남의 장소가 지도에 뜬다.
 * 미인증 사용자는 이 함수를 호출하지 않고 빈 배열을 쓴다(app/page.tsx,
 * app/api/places/route.ts).
 *
 * 순수 헬퍼(clampRating, revivePlace)는 클라이언트 컴포넌트도 쓰므로
 * places.ts 에 남겨 두고, DB 를 만지는 이 조회만 server-only 로 갈라 둔다.
 * Prisma 7 의 pg 드라이버 어댑터는 브라우저 번들에 들어갈 수 없다.
 */
export async function getPlacesInBounds(
  bounds: Bounds,
  userId: string
): Promise<Place[]> {
  return prisma.place.findMany({
    where: {
      userId,
      latitude: { gte: bounds.sw.latitude, lte: bounds.ne.latitude },
      longitude: { gte: bounds.sw.longitude, lte: bounds.ne.longitude },
    },
    take: MAX_PLACES,
    orderBy: { imageCreationTime: "desc" },
  })
}
