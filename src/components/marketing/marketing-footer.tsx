import Link from "next/link"
import { getDemoSiteHref } from "@/lib/demo-site"

type MarketingFooterProps = {
  showHomeLink?: boolean
}

export function MarketingFooter({ showHomeLink = true }: MarketingFooterProps) {
  const demoSiteHref = getDemoSiteHref()

  return (
    <footer className="border-t border-white/10 bg-[#070910]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-10 text-sm text-white/70 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10 ring-1 ring-white/10">
            <span className="text-[12px] font-semibold">VC</span>
          </span>
          <span>VivaCRM</span>
        </div>

        <div className="flex flex-wrap gap-4">
          {showHomeLink ? (
            <Link href="/" className="hover:text-white">
              Home
            </Link>
          ) : null}
          <Link href="/precos" className="hover:text-white">
            Precos
          </Link>
          <Link href="/login" className="hover:text-white">
            Entrar
          </Link>
          <Link href="/register" className="hover:text-white">
            Criar conta
          </Link>
          <Link href={demoSiteHref} className="hover:text-white">
            Demo
          </Link>
        </div>
      </div>
    </footer>
  )
}
