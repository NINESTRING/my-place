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

export async function getAllPlaces(): Promise<Place[]> {
  return prisma.place.findMany({
    take: MAX_PLACES,
    orderBy: { imageCreationTime: "desc" },
  })
}

export async function getPlacesInBounds(bounds: Bounds): Promise<Place[]> {
  return prisma.place.findMany({
    where: {
      latitude: { gte: bounds.sw.latitude, lte: bounds.ne.latitude },
      longitude: { gte: bounds.sw.longitude, lte: bounds.ne.longitude },
    },
    take: MAX_PLACES,
  })
}
