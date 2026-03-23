"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import type { ReactNode } from "react"
import { appendPreviewTheme, resolvePreviewThemeFromParam } from "@/lib/public-site/preview-theme"

type PublicPreviewLinkProps = {
  href: string
  className?: string
  target?: string
  rel?: string
  children: ReactNode
}

export function PublicPreviewLink({ href, className, target, rel, children }: PublicPreviewLinkProps) {
  const searchParams = useSearchParams()
  const previewTheme = resolvePreviewThemeFromParam(searchParams.get("preview_theme"))
  const resolvedHref = appendPreviewTheme(href, previewTheme)

  return (
    <Link href={resolvedHref} className={className} target={target} rel={rel}>
      {children}
    </Link>
  )
}
