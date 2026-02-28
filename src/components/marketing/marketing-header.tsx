"use client"

import Link from "next/link"

type MarketingHeaderActive = "home" | "precos" | "login" | "register"

function linkClass(active: boolean) {
  if (active) {
    return "rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-emerald-300/40"
  }
  return "rounded-xl px-3 py-2 text-sm text-white/80 ring-1 ring-white/10 hover:bg-white/5 hover:text-white"
}

export function MarketingHeader({ active }: { active: MarketingHeaderActive }) {
  const resourcesHref = active === "home" ? "#recursos" : "/#recursos"
  const templatesHref = active === "home" ? "#templates" : "/#templates"

  return (
    <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
      <Link href="/" className="group inline-flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 ring-1 ring-white/10">
          <span className="text-[13px] font-semibold tracking-wide">VC</span>
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold">VivaCRM</span>
          <span className="block text-xs text-white/60">CRM + Site para imobiliárias</span>
        </span>
      </Link>

      <nav className="hidden items-center gap-2 text-sm text-white/80 md:flex">
        <Link href={resourcesHref} className={linkClass(false)}>
          Recursos
        </Link>
        <Link href={templatesHref} className={linkClass(false)}>
          Templates
        </Link>
        <Link href="/precos" className={linkClass(active === "precos")}>
          Precos
        </Link>
        <Link href="/login" className={linkClass(active === "login")}>
          Entrar
        </Link>
      </nav>

      <div className="flex items-center gap-2">
        <Link href="/login" className={linkClass(active === "login") + " inline-flex md:hidden"}>
          Entrar
        </Link>
        <Link
          href="/register"
          className={
            active === "register"
              ? "inline-flex items-center justify-center rounded-xl bg-emerald-300 px-4 py-2 text-sm font-semibold text-black shadow-sm shadow-emerald-300/20 ring-1 ring-emerald-200"
              : "inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-white to-white/90 px-4 py-2 text-sm font-semibold text-black shadow-sm shadow-white/10 ring-1 ring-white/10 hover:from-white hover:to-white"
          }
        >
          Testar gratis
        </Link>
      </div>
    </header>
  )
}
