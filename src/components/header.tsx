"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/", label: "홈" },
  { href: "/create", label: "등록" },
  { href: "/map", label: "지도" },
]

export function Header() {
  const pathname = usePathname()

  return (
    <header className="bg-background/80 border-border sticky top-0 z-10 flex h-[var(--header-height)] items-center justify-center gap-1 border-b backdrop-blur">
      <nav className="flex gap-1">
        {LINKS.map((link) => {
          const active = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                active
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
