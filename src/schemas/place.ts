import { z } from "zod"

const latitude = z.number().min(-90).max(90)
const longitude = z.number().min(-180).max(180)

export const coordinatesSchema = z.object({
  latitude,
  longitude,
})

export const boundsSchema = z.object({
  sw: coordinatesSchema,
  ne: coordinatesSchema,
})

export type Bounds = z.infer<typeof boundsSchema>

/** Route Handler의 쿼리 문자열을 Bounds로 강제한다. */
export const boundsQuerySchema = z
  .object({
    swLat: z.coerce.number().min(-90).max(90),
    swLng: z.coerce.number().min(-180).max(180),
    neLat: z.coerce.number().min(-90).max(90),
    neLng: z.coerce.number().min(-180).max(180),
  })
  .transform((q) => ({
    sw: { latitude: q.swLat, longitude: q.swLng },
    ne: { latitude: q.neLat, longitude: q.neLng },
  }))

export const placeInputSchema = z.object({
  description: z.string().min(1, "설명을 입력해 주세요").max(500),
  image: z.string().min(1),
  imageCreationTime: z.coerce.date(),
  latitude,
  longitude,
  rating: z.number().int().min(1).max(5),
  category: z.number().int().min(1).max(4),
})

export type PlaceInput = z.infer<typeof placeInputSchema>

/** 폼이 다루는 값. 이미지는 업로드 전이므로 File이고 좌표는 EXIF에서 온다. */
export const placeFormSchema = z.object({
  description: z.string().min(1, "설명을 입력해 주세요").max(500),
  rating: z.number().int().min(1).max(5),
  category: z.number().int().min(1).max(4),
})

export type PlaceFormValues = z.infer<typeof placeFormSchema>
