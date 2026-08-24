"use server"

import { revalidatePath } from "next/cache"
import type { ActionResult } from "@/actions/place"
import { Prisma } from "@/generated/prisma/client"
import { getCurrentUserId } from "@/lib/auth"
import type { CategorySummary } from "@/lib/categories"
import { prisma } from "@/lib/prisma"
import {
  categoryIdSchema,
  categoryNameSchema,
  categoryUpdateSchema,
} from "@/schemas/category"

const UNAUTHENTICATED = "로그인이 필요합니다"

// 장소 액션과 같은 이유로 없는 카테고리와 남의 카테고리를 한 문구로 묶는다.
const NOT_FOUND = "카테고리를 찾을 수 없습니다"

/**
 * 카테고리를 만든다. 같은 이름이 이미 있으면 그 행을 돌려준다(멱등) —
 * 폼 안에서 "이미 있습니다" 오류를 보여 주고 사용자가 목록에서 그것을 다시
 * 찾아 누르게 하는 것보다, 그냥 그 카테고리가 선택되는 쪽이 하려던 일이다.
 *
 * upsert 의 update 를 빈 객체로 두므로 기존 행은 아무것도 바뀌지 않는다.
 * unique (user_id, name) 과 upsert 가 한 문장이라 동시 제출 경쟁도 없다.
 */
export async function createCategoryAction(
  input: unknown
): Promise<ActionResult<{ category: CategorySummary }>> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { ok: false, error: UNAUTHENTICATED }
  }

  const parsed = categoryNameSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "입력이 올바르지 않습니다",
    }
  }

  try {
    const category = await prisma.category.upsert({
      where: { userId_name: { userId, name: parsed.data } },
      create: { userId, name: parsed.data },
      update: {},
      select: { id: true, name: true },
    })
    revalidatePath("/")
    return { ok: true, category }
  } catch {
    return { ok: false, error: "카테고리 추가에 실패했습니다" }
  }
}

/**
 * 카테고리 이름을 바꾼다. 이 카테고리를 쓰는 모든 장소 카드에 즉시 반영된다
 * — 조인은 id 로 걸려 있으므로 옮길 것이 없다.
 *
 * 이미 있는 이름으로 바꾸는 것은 병합이 아니라 거부다. 병합은 조인 이동과
 * 중복 정리가 따라오는 조용한 대량 변경이라, 사용자가 의도했는지 알 수 없는
 * 자리에서 저지를 일이 아니다.
 *
 * 소유권은 장소 수정과 같은 한 문장 패턴 — where 에 userId 를 함께 넣고,
 * 걸리지 않으면 P2025 로 떨어진다.
 */
export async function updateCategoryAction(
  input: unknown
): Promise<ActionResult<{ category: CategorySummary }>> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { ok: false, error: UNAUTHENTICATED }
  }

  const parsed = categoryUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "입력이 올바르지 않습니다",
    }
  }

  try {
    const category = await prisma.category.update({
      where: { id: parsed.data.id, userId },
      data: { name: parsed.data.name },
      select: { id: true, name: true },
    })
    revalidatePath("/")
    return { ok: true, category }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { ok: false, error: NOT_FOUND }
      }
      // P2002 = unique (user_id, name) 위반.
      if (error.code === "P2002") {
        return { ok: false, error: "이미 같은 이름의 카테고리가 있습니다" }
      }
    }
    return { ok: false, error: "이름 변경에 실패했습니다" }
  }
}

/**
 * 카테고리를 지운다. 조인 행은 FK Cascade 가 함께 지우므로, 이 카테고리를
 * 쓰던 장소들에서는 라벨만 사라지고 장소 자체는 남는다.
 */
export async function deleteCategoryAction(
  input: unknown
): Promise<ActionResult<object>> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { ok: false, error: UNAUTHENTICATED }
  }

  const parsed = categoryIdSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: NOT_FOUND }
  }

  try {
    await prisma.category.delete({ where: { id: parsed.data, userId } })
    revalidatePath("/")
    return { ok: true }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { ok: false, error: NOT_FOUND }
    }
    return { ok: false, error: "삭제에 실패했습니다" }
  }
}
