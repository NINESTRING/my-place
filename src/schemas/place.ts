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

/**
 * URLSearchParams.get()은 파라미터가 없으면 null을 반환하고,
 * z.coerce.number()는 Number(null) === 0이라 null을 유효한 0으로 강제해
 * 버린다. 빈 문자열도 Number("") === 0이라 같은 문제가 있다. 강제하기
 * 전에 null과 빈 문자열을 명시적으로 거부한다.
 */
const requiredNumericString = z
  .string()
  .min(1)
  .pipe(z.coerce.number())

/** Route Handler의 쿼리 문자열을 Bounds로 강제한다. */
export const boundsQuerySchema = z
  .object({
    swLat: requiredNumericString.pipe(latitude),
    swLng: requiredNumericString.pipe(longitude),
    neLat: requiredNumericString.pipe(latitude),
    neLng: requiredNumericString.pipe(longitude),
  })
  .transform((q) => ({
    sw: { latitude: q.swLat, longitude: q.swLng },
    ne: { latitude: q.neLat, longitude: q.neLng },
  }))

export const placeInputSchema = z.object({
  description: z.string().min(1, "설명을 입력해 주세요").max(500),
  image: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://res.cloudinary.com/"), {
      message: "이미지 URL이 올바르지 않습니다",
    }),
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
