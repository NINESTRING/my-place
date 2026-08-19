import type { Place } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { Bounds } from "@/schemas/place"

export type PlaceWithPublicId = Place & { publicId: string }

const MAX_PLACES = 50

/**
 * Cloudinary secure_url에서 publicId(마지막 세그먼트)를 추출한다.
 * next/image의 커스텀 로더가 이 값을 src로 받는다.
 */
export function publicIdFromUrl(url: string): string {
  const parts = url.split("/")
  return parts[parts.length - 1]
}

function withPublicId(place: Place): PlaceWithPublicId {
  return { ...place, publicId: publicIdFromUrl(place.image) }
}

/** 별점을 0~5 범위로 고정한다. 마이그레이션 이전 데이터에는 상한·하한이 없었다. */
export function clampRating(rating: number): number {
  return Math.max(0, Math.min(5, rating))
}

/** JSON 전송 후의 Place — Date 필드가 문자열로 바뀐 형태. */
export type SerializedPlace = Omit<
  PlaceWithPublicId,
  "imageCreationTime" | "createdAt" | "updatedAt"
> & {
  imageCreationTime: string
  createdAt: string
  updatedAt: string
}

/** SerializedPlace 를 다시 PlaceWithPublicId 로 되돌린다. */
export function revivePlace(place: SerializedPlace): PlaceWithPublicId {
  return {
    ...place,
    imageCreationTime: new Date(place.imageCreationTime),
    createdAt: new Date(place.createdAt),
    updatedAt: new Date(place.updatedAt),
  }
}

export async function getAllPlaces(): Promise<PlaceWithPublicId[]> {
  const places = await prisma.place.findMany({
    take: MAX_PLACES,
    orderBy: { imageCreationTime: "desc" },
  })
  return places.map(withPublicId)
}

export async function getPlacesInBounds(
  bounds: Bounds
): Promise<PlaceWithPublicId[]> {
  const places = await prisma.place.findMany({
    where: {
      latitude: { gte: bounds.sw.latitude, lte: bounds.ne.latitude },
      longitude: { gte: bounds.sw.longitude, lte: bounds.ne.longitude },
    },
    take: MAX_PLACES,
  })
  return places.map(withPublicId)
}
