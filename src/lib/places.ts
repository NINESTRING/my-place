import type { Place } from "@/generated/prisma/client"

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
