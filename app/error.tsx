"use client"

import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-start gap-4 px-4 py-16">
      <h1 className="text-xl font-bold">문제가 발생했습니다</h1>
      <p className="text-muted-foreground text-sm">{error.message}</p>
      <Button onClick={reset}>다시 시도</Button>
    </main>
  )
}
