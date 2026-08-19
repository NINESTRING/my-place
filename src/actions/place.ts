"use server"

/**
 * 주의: 이 액션들에는 인가 검사가 없다. 인증은 이번 마이그레이션의 명시적
 * 비목표이며, userId 는 src/lib/auth.ts 의 getCurrentUserId() 가 반환하는
 * 고정값 "1" 이다. 인증을 붙일 때 그 함수 하나만 실제 구현으로 바꾸면
 * 모든 쓰기 경로에 적용된다.
 */

import { revalidatePath } from "next/cache"
import { getCurrentUserId } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PLACES_BUCKET, supabaseAdmin } from "@/lib/supabase"
import { placeInputSchema } from "@/schemas/place"

export type ActionResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

/** 허용 MIME 타입과 저장 확장자. HEIC 는 Next 내장 최적화가 다루지 못해 제외한다. */
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

/**
 * 브라우저가 Storage 에 직접 올릴 수 있는 서명 URL 을 발급한다.
 *
 * 경로를 서버가 정하는 것이 요점이다. 클라이언트가 경로를 지정하면 남의
 * 객체를 덮어쓸 수 있다. 서명 URL 은 토큰 자체가 인증 수단이라(유효기간
 * 2시간) 브라우저에 Supabase 키를 내보내지 않아도 된다.
 */
export async function createUploadUrlAction(
  contentType: string
): Promise<ActionResult<{ signedUrl: string; path: string }>> {
  const extension = EXTENSIONS[contentType]
  if (!extension) {
    return { ok: false, error: "JPEG, PNG, WebP 이미지만 올릴 수 있습니다" }
  }

  const { data, error } = await supabaseAdmin.storage
    .from(PLACES_BUCKET)
    .createSignedUploadUrl(`${crypto.randomUUID()}.${extension}`)

  if (error || !data) {
    return { ok: false, error: "업로드 URL 발급에 실패했습니다" }
  }

  return { ok: true, signedUrl: data.signedUrl, path: data.path }
}

export async function createPlaceAction(
  input: unknown
): Promise<ActionResult<{ id: number }>> {
  const parsed = placeInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "입력이 올바르지 않습니다" }
  }

  const userId = await getCurrentUserId()

  try {
    const place = await prisma.place.create({
      data: { ...parsed.data, userId },
    })
    revalidatePath("/")
    revalidatePath("/map")
    return { ok: true, id: place.id }
  } catch {
    return { ok: false, error: "저장에 실패했습니다" }
  }
}
