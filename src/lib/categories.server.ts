import "server-only"

import { sortCategories, type CategorySummary } from "@/lib/categories"
import { prisma } from "@/lib/prisma"

/**
 * 이 사용자가 만든 카테고리 전부. 등록·수정 폼의 선택지가 된다.
 *
 * places.server.ts 의 조회들과 같은 이유로 userId 가 필수 인자다 — 옵셔널이면
 * 필터를 빼먹은 호출이 조용히 통과해 남의 카테고리가 폼에 뜬다.
 */
export async function getCategories(
  userId: string
): Promise<CategorySummary[]> {
  const categories = await prisma.category.findMany({
    where: { userId },
    select: { id: true, name: true },
  })
  // DB 정렬 대신 화면과 같은 콜레이터(localeCompare)로 정렬한다. 클라이언트가
  // 새 카테고리를 append 한 뒤 정렬하는 것과 기준이 다르면 순서가 튄다.
  return sortCategories(categories)
}

/**
 * 제출된 카테고리 id 들이 전부 이 사용자의 것인지 확인한다.
 *
 * 형식 검증(Zod)은 "양의 정수 배열"까지만 본다. 남의 카테고리 id 를 붙이는
 * 것을 막는 것은 세션을 아는 이 대조뿐이다. id 는 스키마가 중복을 접어 준
 * 뒤라 count 비교로 충분하다.
 */
export async function ownsAllCategories(
  categoryIds: readonly number[],
  userId: string
): Promise<boolean> {
  if (categoryIds.length === 0) return true
  const count = await prisma.category.count({
    where: { id: { in: [...categoryIds] }, userId },
  })
  return count === categoryIds.length
}
