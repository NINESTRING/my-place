import { z } from "zod"
import { PlaceCategory } from "@/generated/prisma/enums"

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

/**
 * 폼과 서버 입력이 공유하는 사용자 작성 필드. 예전에는 두 스키마가 같은
 * 필드를 각각 정의해서, 폼의 defaultValues 까지 합쳐 세 곳이 서로 어긋날 수
 * 있었다.
 */
const placeFields = {
  title: z
    .string()
    .min(1, "제목을 입력해 주세요")
    .max(60, "제목은 60자까지 쓸 수 있습니다"),
  /**
   * 손대지 않은 Textarea 는 ""를 보낸다. DB 에 ""와 null 이 섞이면 "설명이
   * 있는지" 판정이 두 갈래가 되므로 경계에서 undefined 로 접는다. Prisma 는
   * undefined 를 "값 없음"으로 보고 nullable 컬럼에 NULL 을 넣는다.
   *
   * transform 을 거쳐도 입력 타입과 출력 타입이 모두 `string | undefined` 라서
   * react-hook-form 이 이 스키마를 그대로 resolver 로 쓸 수 있다.
   */
  description: z
    .string()
    .max(500, "설명은 500자까지 쓸 수 있습니다")
    .transform((value) => value.trim() || undefined)
    .optional(),
  /**
   * 선택 값이다. 기본값을 두면 신경 쓰지 않은 장소가 전부 그 값으로
   * 저장되어(옛 코드의 category: 1 = 카페) 값 자체를 믿을 수 없게 된다.
   */
  category: z.enum(PlaceCategory).nullable(),
}

export const placeInputSchema = z.object({
  ...placeFields,
  image: imagePath,
  imageCreationTime: z.coerce.date(),
  latitude,
  longitude,
})

export type PlaceInput = z.infer<typeof placeInputSchema>

/** 폼이 다루는 값. 이미지는 업로드 전이므로 File이고 좌표는 EXIF에서 온다. */
export const placeFormSchema = z.object(placeFields)

export type PlaceFormValues = z.infer<typeof placeFormSchema>
