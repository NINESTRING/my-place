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

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"

/**
 * 저장 경로는 서버 액션이 정하므로 형식이 고정되어 있다: `<userId>/<uuid>.<ext>`.
 * 이 정규식은 클라이언트가 보낸 값이 그 형식임을 확인해 경로 이탈이나 임의
 * 객체 참조를 막는다.
 *
 * 앞 세그먼트가 소유자(Supabase auth 사용자 UUID)이며, 형식 검사만으로는
 * "누구의 것인지"까지 알 수 없다. 그 대조는 createPlaceAction 이
 * isOwnedImagePath() 로 세션의 userId 와 비교해서 한다. 여기서는 UUID 두 개
 * 구조라는 것만 보장한다.
 */
const imagePath = z
  .string()
  .regex(
    new RegExp(`^${UUID}/${UUID}\\.(jpg|png|webp)$`),
    "이미지 경로가 올바르지 않습니다"
  )

export const placeInputSchema = z.object({
  description: z.string().min(1, "설명을 입력해 주세요").max(500),
  image: imagePath,
  imageCreationTime: z.coerce.date(),
  latitude,
  longitude,
  category: z.number().int().min(1).max(4),
})

export type PlaceInput = z.infer<typeof placeInputSchema>

/** 폼이 다루는 값. 이미지는 업로드 전이므로 File이고 좌표는 EXIF에서 온다. */
export const placeFormSchema = z.object({
  description: z.string().min(1, "설명을 입력해 주세요").max(500),
  category: z.number().int().min(1).max(4),
})

export type PlaceFormValues = z.infer<typeof placeFormSchema>
