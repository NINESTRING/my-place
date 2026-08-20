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
 * 순수 헬퍼(revivePlace)는 클라이언트 컴포넌트도 쓰므로 places.ts 에
 * 남겨 두고, DB 를 만지는 이 조회만 server-only 로 갈라 둔다.
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

/**
 * 이 사용자가 등록한 장소 **전체**. 목록 패널의 기본 화면이 "지금 보이는
 * 영역"이 아니라 "내가 등록한 모든 장소"이므로 bounds 도 개수 상한도 두지
 * 않는다. 지도에 그릴 마커는 여전히 getPlacesInBounds 가 맡는다.
 *
 * 상한을 두지 않는 것이 의도적이다. 개인이 다녀온 장소는 많아야 수백 건이고,
 * 상한을 두면 "전체"라고 적힌 목록에서 오래된 장소가 아무 표시 없이 사라진다.
 * 그 규모를 넘어서면 상한이 아니라 페이지네이션으로 풀 일이다.
 */
export async function getAllPlaces(userId: string): Promise<Place[]> {
  return prisma.place.findMany({
    where: { userId },
    orderBy: { imageCreationTime: "desc" },
  })
}

/**
 * 가장 최근에 다녀온 장소 한 건. 첫 화면을 어디로 띄울지 정하는 데 쓴다.
 *
 * 정렬 기준은 목록과 같은 촬영 시각이다. 등록 시각으로 잡으면 예전 사진을
 * 방금 올렸을 때 목록 맨 위와 지도가 서로 다른 곳을 가리킨다.
 */
export async function getLatestPlace(userId: string): Promise<Place | null> {
  return prisma.place.findFirst({
    where: { userId },
    orderBy: { imageCreationTime: "desc" },
  })
}
