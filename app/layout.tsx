import type { Metadata } from "next"
import { Header } from "@/components/header"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: "my-place",
  description: "사진으로 다녀온 장소를 기록하고 지도에 모아 봅니다",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="bg-background text-foreground min-h-dvh antialiased">
        <Header />
        {children}
        <Toaster />
      </body>
    </html>
  )
}
