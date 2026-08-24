import "server-only"

import type { PlaceWithCategories } from "@/lib/places"
import { prisma } from "@/lib/prisma"

/**
 * 공유 토큰으로 카테고리와 그 장소 전체를 조회한다. 미인증 열람의 유일한
 * 입구이므로 스코프(토큰)가 필수 인자인 것은 places.server.ts 와 같은
 * 이유다.
 *
 * 없는 토큰·공유가 꺼진 토큰을 구분 없이 null 로 접는다 — 꺼진 링크의
 * 존재가 새면 "예전에 공유했던 적이 있다"는 사실이 새는 것이다.
 *
 * 장소 수 상한을 두지 않는 것은 getAllPlaces 와 같은 판단이다. 개수는
 * 개인 기록 규모(수십~수백)를 넘지 않고, 공유 화면은 재조회 없이 이 한 번의
 * 결과로만 그린다.
 */
export async function getSharedPlaces(
  token: string
): Promise<{ name: string; places: PlaceWithCategories[] } | null> {
  const category = await prisma.category.findUnique({
    where: { shareToken: token },
    select: { id: true, name: true, shareEnabled: true },
  })
  if (!category?.shareEnabled) return null

  const rows = await prisma.place.findMany({
    where: { categories: { some: { categoryId: category.id } } },
    orderBy: { imageCreationTime: "desc" },
  })

  return {
    name: category.name,
    // categories 를 일부러 비워 보낸다. 공유된 장소가 공유되지 않은 다른
    // 카테고리("데이트 코스" 같은)도 달고 있을 수 있고, 그 이름이 방문자에게
    // 새면 안 된다. 화면 쪽에서도 전부 같은 카테고리라 라벨의 정보 가치가
    // 없다.
    places: rows.map((place) => ({ ...place, categories: [] })),
  }
}
