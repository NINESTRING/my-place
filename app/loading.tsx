import { Skeleton } from "@/components/ui/skeleton"

// 한 화면짜리 지도 앱이므로 로딩 자리도 지도 모양으로 잡는다.
export default function Loading() {
  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <Skeleton className="h-full w-full rounded-none" />
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <Skeleton className="size-11 rounded-full" />
        <Skeleton className="size-11 rounded-full" />
      </div>
    </div>
  )
}
