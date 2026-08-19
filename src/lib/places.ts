import type { Place } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { Bounds } from "@/schemas/place"

const MAX_PLACES = 50

/** 별점을 0~5 범위로 고정한다. 마이그레이션 이전 데이터에는 상한·하한이 없었다. */
export function clampRating(rating: number): number {
  return Math.max(0, Math.min(5, rating))
}

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
 * 지도에 보이는 영역의 장소. 마커와 목록 패널이 이 한 번의 조회를 함께
 * 쓰므로, 목록에 그대로 쓸 수 있도록 최신 촬영 순으로 정렬해 돌려준다.
 */
export async function getPlacesInBounds(bounds: Bounds): Promise<Place[]> {
  return prisma.place.findMany({
    where: {
      latitude: { gte: bounds.sw.latitude, lte: bounds.ne.latitude },
      longitude: { gte: bounds.sw.longitude, lte: bounds.ne.longitude },
    },
    take: MAX_PLACES,
    orderBy: { imageCreationTime: "desc" },
  })
}
