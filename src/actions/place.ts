"use server"

/**
 * 쓰기 경로의 인가는 두 겹이다.
 *
 * 1. 세션 — getCurrentUserId() 가 null 이면 아무것도 하지 않는다. userId 는
 *    Supabase auth 가 서명을 검증한 JWT 의 sub 이며 클라이언트가 보낸 값이
 *    아니다.
 * 2. 경로 소유권 — 저장 경로가 `<userId>/<uuid>.<ext>` 라서 제출된 image 값의
 *    앞 세그먼트를 세션의 userId 와 대조하면 소유권이 증명된다.
 *
 * 2번이 필요한 이유는 서명 URL 발급과 행 생성이 서로 다른 요청이기 때문이다.
 * 클라이언트가 A 경로로 서명 URL 을 받고 실제로는 다른 well-formed 경로를
 * 제출할 수 있다. 인증이 없던 시절에는 결과가 "이미 공개된 이미지를 가리키는
 * 행" 정도였지만, 이제는 사용자 A 가 사용자 B 의 사진을 자기 장소에 붙이는
 * 인가 버그가 된다. 경로에 소유자를 박아 그 창을 닫는다.
 */

import { revalidatePath } from "next/cache"
import { getCurrentUserId } from "@/lib/auth"
import {
  isOwnedImagePath,
  storageExtension,
  userScopedImagePath,
} from "@/lib/images"
import { prisma } from "@/lib/prisma"
import { PLACES_BUCKET, supabaseAdmin } from "@/lib/supabase/admin"
import { placeInputSchema } from "@/schemas/place"

export type ActionResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

const UNAUTHENTICATED = "로그인이 필요합니다"

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
  const userId = await getCurrentUserId()
  if (!userId) {
    return { ok: false, error: UNAUTHENTICATED }
  }

  const extension = storageExtension(contentType)
  if (!extension) {
    return { ok: false, error: "JPEG, PNG, WebP 이미지만 올릴 수 있습니다" }
  }

  const { data, error } = await supabaseAdmin.storage
    .from(PLACES_BUCKET)
    .createSignedUploadUrl(userScopedImagePath(userId, extension))

  if (error || !data) {
    return { ok: false, error: "업로드 URL 발급에 실패했습니다" }
  }

  return { ok: true, signedUrl: data.signedUrl, path: data.path }
}

export async function createPlaceAction(
  input: unknown
): Promise<ActionResult<{ id: number }>> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { ok: false, error: UNAUTHENTICATED }
  }

  const parsed = placeInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "입력이 올바르지 않습니다" }
  }

  // 스키마는 경로가 `<uuid>/<uuid>.<ext>` 형식인지만 본다. 그 앞 세그먼트가
  // *이* 사용자인지는 세션을 알아야 판단할 수 있으므로 여기서 대조한다.
  if (!isOwnedImagePath(parsed.data.image, userId)) {
    return { ok: false, error: "이미지 경로가 올바르지 않습니다" }
  }

  try {
    const place = await prisma.place.create({
      data: { ...parsed.data, userId },
    })
    revalidatePath("/")
    return { ok: true, id: place.id }
  } catch {
    return { ok: false, error: "저장에 실패했습니다" }
  }
}
