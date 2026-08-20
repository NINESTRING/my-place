import { NextResponse, type NextRequest } from "next/server"
import { getCurrentUserId } from "@/lib/auth"
import { getPlacesInBounds } from "@/lib/places.server"
import { boundsQuerySchema } from "@/schemas/place"

export async function GET(request: NextRequest) {
  // 미인증이면 빈 목록. 401 이 아니라 200 + [] 인 이유는 이 엔드포인트가
  // 지도 이동마다 호출되고, 로그인하지 않은 상태에서 마커 없는 지도를 보는
  // 것이 오류가 아니라 정상 화면이기 때문이다.
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ places: [] })
  }

  const sp = request.nextUrl.searchParams
  const parsed = boundsQuerySchema.safeParse({
    swLat: sp.get("swLat"),
    swLng: sp.get("swLng"),
    neLat: sp.get("neLat"),
    neLng: sp.get("neLng"),
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: "bounds 파라미터가 올바르지 않습니다" },
      { status: 400 }
    )
  }

  const places = await getPlacesInBounds(parsed.data, userId)
  return NextResponse.json({ places })
}
