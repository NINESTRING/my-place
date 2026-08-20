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
import {
  placeIdSchema,
  placeInputSchema,
  placeUpdateSchema,
} from "@/schemas/place"

export type ActionResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

const UNAUTHENTICATED = "로그인이 필요합니다"

// 없는 장소와 남의 장소를 같은 문구로 묶는다. 갈라 놓으면 남의 행이
// 존재하는지가 응답으로 새어 나간다.
const NOT_FOUND = "장소를 찾을 수 없습니다"

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

/**
 * 사용자가 쓴 세 필드(제목·설명·카테고리)를 고친다.
 *
 * 소유권을 `where` 에 넣는 것이 요점이다. findFirst 로 읽어 userId 를 비교한
 * 뒤 update 하면 두 문장 사이에 창이 생기고, 검사와 갱신이 서로 다른 조건을
 * 보게 될 여지가 남는다. 조건을 SQL 한 문장에 넣으면 갱신된 행 수가 곧
 * 인가 결과다.
 */
export async function updatePlaceAction(
  input: unknown
): Promise<ActionResult<object>> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { ok: false, error: UNAUTHENTICATED }
  }

  const parsed = placeUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "입력이 올바르지 않습니다",
    }
  }

  const { id, title, description, category } = parsed.data

  try {
    const { count } = await prisma.place.updateMany({
      where: { id, userId },
      data: {
        title,
        // 스키마가 빈 설명을 undefined 로 접는데, Prisma 는 undefined 를
        // "이 컬럼은 건드리지 않음" 으로 읽는다. 그대로 넘기면 설명을 지운
        // 수정이 조용히 무시되어 옛 설명이 남는다. null 로 바꿔 비운다.
        description: description ?? null,
        category,
        // schema.prisma 의 updatedAt 은 @default(now()) 뿐이고 @updatedAt 이
        // 없다. 여기서 넣지 않으면 생성 시각에 머문다.
        updatedAt: new Date(),
      },
    })

    if (count === 0) {
      return { ok: false, error: NOT_FOUND }
    }

    revalidatePath("/")
    return { ok: true }
  } catch {
    return { ok: false, error: "수정에 실패했습니다" }
  }
}

/**
 * 장소를 지운다. DB 행과 Storage 사진을 함께 없앤다.
 *
 * 순서가 DB 먼저인 것이 중요하다. 두 저장소에 걸친 삭제라 어느 쪽이든 중간에
 * 실패할 수 있는데, Storage 를 먼저 지우면 실패 지점에서 "행은 남았는데 사진만
 * 404 인 카드" 가 화면에 남는다. 반대 순서의 최악은 아무도 참조하지 않는 파일
 * 하나가 버킷에 남는 것이고, 이건 보이지도 않고 나중에 일괄 정리할 수 있다.
 * 그래서 Storage 삭제는 best-effort 로 두고 실패해도 사용자에게는 성공으로
 * 답한다 — 그의 관점에서 삭제는 실제로 끝났다.
 */
export async function deletePlaceAction(
  input: unknown
): Promise<ActionResult<object>> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { ok: false, error: UNAUTHENTICATED }
  }

  const parsed = placeIdSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: NOT_FOUND }
  }

  const id = parsed.data

  // 지울 사진 경로를 알아야 하므로 한 번 읽는다. 여기서도 소유자 조건을
  // where 에 넣어 남의 행이 조회되지 않게 한다.
  let place: { image: string } | null
  try {
    place = await prisma.place.findFirst({
      where: { id, userId },
      select: { image: true },
    })
  } catch {
    return { ok: false, error: "삭제에 실패했습니다" }
  }

  if (!place) {
    return { ok: false, error: NOT_FOUND }
  }

  try {
    await prisma.place.deleteMany({ where: { id, userId } })
  } catch {
    return { ok: false, error: "삭제에 실패했습니다" }
  }

  // supabaseAdmin 은 service role 이라 RLS 를 우회한다. 경로는 방금 소유권을
  // 확인한 행에서 읽은 값이지만, 등록 시점 검증을 빠져나온 낡은 행이 있다면
  // 그 경로가 그대로 admin 클라이언트에 넘어간다. 한 줄로 막는다.
  if (isOwnedImagePath(place.image, userId)) {
    const { error } = await supabaseAdmin.storage
      .from(PLACES_BUCKET)
      .remove([place.image])
    if (error) {
      console.error("Storage 객체 삭제 실패", place.image, error)
    }
  }

  revalidatePath("/")
  return { ok: true }
}
