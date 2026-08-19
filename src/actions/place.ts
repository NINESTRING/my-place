"use server"

/**
 * 주의: 이 액션들에는 인가 검사가 없다. 인증은 이번 마이그레이션의 명시적
 * 비목표이며, userId 는 src/lib/auth.ts 의 getCurrentUserId() 가 반환하는
 * 고정값 "1" 이다. 인증을 붙일 때 그 함수 하나만 실제 구현으로 바꾸면
 * 모든 쓰기 경로에 적용된다.
 *
 * 단, 이 서술은 userId 주입에만 참이다. createUploadUrlAction 이 발급한
 * 서명 URL 의 path 와 createPlaceAction 에 제출되는 path 는 서로 바인딩되지
 * 않는다 — 클라이언트가 A 경로로 서명 URL 을 받고 업로드하지 않은 채 다른
 * well-formed 경로를 제출해도 지금은 통과한다. 인증이 없는 지금은 "이미
 * 공개된 이미지를 가리키는 행" 정도로 결과가 국한되지만, getCurrentUserId()
 * 를 실제 구현으로 바꾸는 순간 이것은 인가 버그가 된다(사용자 A 가 사용자
 * B 의 이미지를 자기 행에 붙일 수 있음). 인증을 붙일 때 path 바인딩(예:
 * 서명 URL 발급 시 userId 를 경로/토큰에 묶고 저장 시 검증)을 함께 구현해야
 * 한다.
 */

import { revalidatePath } from "next/cache"
import { getCurrentUserId } from "@/lib/auth"
import { storageExtension } from "@/lib/images"
import { prisma } from "@/lib/prisma"
import { PLACES_BUCKET, supabaseAdmin } from "@/lib/supabase"
import { placeInputSchema } from "@/schemas/place"

export type ActionResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

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
  const extension = storageExtension(contentType)
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
    return { ok: true, id: place.id }
  } catch {
    return { ok: false, error: "저장에 실패했습니다" }
  }
}
