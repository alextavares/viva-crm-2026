"use client"

import { usePathname } from "next/navigation"
import { AuthProvider } from "@/contexts/auth-context"

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ""

  // Public website pages must not initialize the Supabase auth client.
  // Otherwise, @supabase/auth-js can throw AbortError due to lock races even for anon visitors.
  const isPublicSite = pathname.startsWith("/s/")

  // Marketing pages must stay lightweight and not initialize auth.
  const isMarketing =
    pathname === "/" || pathname === "/precos" || pathname.startsWith("/precos/")

  if (isPublicSite || isMarketing) return <>{children}</>

  return <AuthProvider>{children}</AuthProvider>
}
