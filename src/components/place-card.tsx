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
      <div className="relative aspect-[16/9] w-full">
        <Image
          src={publicImageUrl(place.image)}
          alt={place.title}
          fill
          sizes="(max-width: 640px) 100vw, 640px"
          className="object-cover"
        />
      </div>
      <CardContent className="space-y-2 p-4">
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <span>{takenAt}</span>
          {category && <span>{category}</span>}
        </div>
        <p className="font-medium">{place.title}</p>
        {place.description && (
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {place.description}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
