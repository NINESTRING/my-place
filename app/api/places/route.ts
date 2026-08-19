import { NextResponse, type NextRequest } from "next/server"
import { getPlacesInBounds } from "@/lib/places"
import { boundsQuerySchema } from "@/schemas/place"

export async function GET(request: NextRequest) {
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

  const places = await getPlacesInBounds(parsed.data)
  return NextResponse.json({ places })
}
