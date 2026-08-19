import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-start gap-4 px-4 py-16">
      <h1 className="text-xl font-bold">페이지를 찾을 수 없습니다</h1>
      <Button render={<Link href="/">홈으로</Link>} />
    </main>
  )
}
