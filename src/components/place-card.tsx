import type { Place } from "@/generated/prisma/client"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { categoryLabel } from "@/lib/categories"
import { publicImageUrl } from "@/lib/images"

export function PlaceCard({ place }: { place: Place }) {
  const takenAt = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(place.imageCreationTime)
  const category = categoryLabel(place.category)

  return (
    <Card className="overflow-hidden p-0">
      {/* 좁은 화면에서는 사진을 크게 세운 카드가 한 장에 화면 절반을 먹어서
          목록을 훑을 수가 없다. 폰에서만 사진을 썸네일로 줄여 가로로 눕히고,
          sm 이상은 사진을 앞세운 원래 배치를 그대로 쓴다. */}
      <div className="flex sm:block">
        <div className="relative aspect-square w-24 shrink-0 sm:aspect-[16/9] sm:w-full">
          <Image
            src={publicImageUrl(place.image)}
            alt={place.title}
            fill
            sizes="(max-width: 639px) 96px, 640px"
            className="object-cover"
          />
        </div>
        <CardContent className="min-w-0 flex-1 space-y-1 p-3 sm:space-y-2 sm:p-4">
          <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs sm:text-sm">
            <span className="truncate">{takenAt}</span>
            {category && <span className="shrink-0">{category}</span>}
          </div>
          <p className="truncate font-medium sm:whitespace-normal">
            {place.title}
          </p>
          {place.description && (
            <p className="text-muted-foreground line-clamp-2 text-xs sm:text-sm">
              {place.description}
            </p>
          )}
        </CardContent>
      </div>
    </Card>
  )
}
