"use server"

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
