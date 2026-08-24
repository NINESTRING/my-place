import type { Place } from "@/generated/prisma/client"
import type { CategorySummary } from "@/lib/categories"
import type { Bounds, Coordinates } from "@/schemas/place"

/**
 * 화면이 다루는 장소의 기본형. 조회(places.server.ts)가 조인을 평탄화해
 * 이 모양으로 돌려주므로, 컴포넌트는 조인 테이블의 존재를 모른다.
 */
export type PlaceWithCategories = Place & { categories: CategorySummary[] }

/** JSON 전송 후의 장소 — Date 필드가 문자열로 바뀐 형태. */
export type SerializedPlace = Omit<
  PlaceWithCategories,
  "imageCreationTime" | "createdAt" | "updatedAt"
> & {
  imageCreationTime: string
  createdAt: string
  updatedAt: string
}

/** SerializedPlace 를 다시 PlaceWithCategories 로 되돌린다. */
export function revivePlace(place: SerializedPlace): PlaceWithCategories {
  return {
    ...place,
    imageCreationTime: new Date(place.imageCreationTime),
    createdAt: new Date(place.createdAt),
    updatedAt: new Date(place.updatedAt),
  }
}

/**
 * 첫 화면에서 한 지점을 가운데 두고 조회할 대략적인 범위. 위도 0.05도는 약
 * 5.5km 이므로 한 변이 10km 남짓인 상자다.
 *
 * 실제 뷰포트 크기는 화면 비율과 줌에 달렸으므로 서버가 알 수 없다. 첫
 * 페인트에 마커가 비어 보이지 않을 만큼만 넉넉히 잡고, 지도가 한 번이라도
 * 움직이면 진짜 bounds 로 다시 조회된다.
 */
const INITIAL_SPAN = 0.05

/**
 * 한 지점을 가운데 두는 조회 범위. 극지방에서 위도가 범위를 벗어나지 않게
 * 자른다. 날짜변경선을 넘는 경우는 다루지 않는다 — 그런 범위는 두 개의
 * 상자로 갈라야 하는데, 이 값은 첫 페인트용 근사치일 뿐이고 지도가 움직이면
 * 곧바로 실제 bounds 로 덮인다.
 */
export function boundsAround(center: Coordinates): Bounds {
  return {
    sw: {
      latitude: Math.max(center.latitude - INITIAL_SPAN, -90),
      longitude: Math.max(center.longitude - INITIAL_SPAN, -180),
    },
    ne: {
      latitude: Math.min(center.latitude + INITIAL_SPAN, 90),
      longitude: Math.min(center.longitude + INITIAL_SPAN, 180),
    },
  }
}

/**
 * 보여 줄 장소도 저장된 위치도 없을 때 쓰는 범위(수도권 전체). 홈은
 * 클라이언트가 저장된 위치로 곧 다시 조회하므로 넉넉하면 되고, 공유
 * 페이지는 빈 카테고리일 때 이 범위를 그대로 띄운다.
 */
export const FALLBACK_BOUNDS: Bounds = {
  sw: { latitude: 37, longitude: 126 },
  ne: { latitude: 38, longitude: 128 },
}

/**
 * 점들 전체를 덮는 최소 상자. 공유 페이지가 첫 화면을 "이 카테고리의 모든
 * 장소가 보이는 범위"로 띄우는 데 쓴다. 빈 배열이면 null — 지도 초기화에
 * 쓰이는 값이라 "0 개의 점을 덮는 상자"라는 거짓 값을 만들지 않는다.
 * 날짜변경선을 넘는 분포는 boundsAround 와 같은 이유로 다루지 않는다.
 */
export function boundsOf(points: readonly Coordinates[]): Bounds | null {
  const first = points[0]
  if (!first) return null

  let bounds = {
    sw: { latitude: first.latitude, longitude: first.longitude },
    ne: { latitude: first.latitude, longitude: first.longitude },
  }
  for (const point of points) {
    bounds = {
      sw: {
        latitude: Math.min(bounds.sw.latitude, point.latitude),
        longitude: Math.min(bounds.sw.longitude, point.longitude),
      },
      ne: {
        latitude: Math.max(bounds.ne.latitude, point.latitude),
        longitude: Math.max(bounds.ne.longitude, point.longitude),
      },
    }
  }
  return bounds
}
