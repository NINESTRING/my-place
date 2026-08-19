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
