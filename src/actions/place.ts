"use server"

/**
 * 주의: 이 액션들에는 인가 검사가 없다. 인증은 이번 마이그레이션의 명시적
 * 비목표이며, userId 는 src/lib/auth.ts 의 getCurrentUserId() 가 반환하는
 * 고정값 "1" 이다. 인증을 붙일 때 그 함수 하나만 실제 구현으로 바꾸면
 * 모든 쓰기 경로에 적용된다.
 */

import { revalidatePath } from "next/cache"
import { v2 as cloudinary } from "cloudinary"
import { getCurrentUserId } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { placeInputSchema } from "@/schemas/place"

export type ActionResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

export async function createUploadSignature(): Promise<
  ActionResult<{ signature: string; timestamp: number }>
> {
  const secret = process.env.CLOUDINARY_SECRET
  if (!secret) {
    return { ok: false, error: "Cloudinary 설정이 없습니다" }
  }

  const timestamp = Math.round(Date.now() / 1000)
  const signature = cloudinary.utils.api_sign_request({ timestamp }, secret)
  return { ok: true, signature, timestamp }
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
