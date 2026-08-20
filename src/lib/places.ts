import type { Place } from "@/generated/prisma/client"
import type { Bounds, Coordinates } from "@/schemas/place"

/** JSON 전송 후의 Place — Date 필드가 문자열로 바뀐 형태. */
export type SerializedPlace = Omit<
  Place,
  "imageCreationTime" | "createdAt" | "updatedAt"
> & {
  imageCreationTime: string
  createdAt: string
  updatedAt: string
}

/** SerializedPlace 를 다시 Place 로 되돌린다. */
export function revivePlace(place: SerializedPlace): Place {
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
