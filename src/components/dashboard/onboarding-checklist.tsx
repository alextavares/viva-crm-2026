"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, ChevronDown, ChevronUp, Circle, ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type Item = {
  done: boolean
  title: string
  description: string
  href: string
  cta: string
  external?: boolean
  adminOnlyAction?: boolean
  optional?: boolean
}

function ItemRow({ item, canAct }: { item: Item; canAct: boolean }) {
  const Icon = item.done ? CheckCircle2 : Circle

  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border bg-card/50 p-4">
      <div className="flex items-start gap-3">
        <Icon className={item.done ? "mt-0.5 h-5 w-5 text-emerald-500" : "mt-0.5 h-5 w-5 text-muted-foreground"} />
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span>{item.title}</span>
            {item.optional ? (
              <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Opcional
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{item.description}</div>
        </div>
      </div>
      {canAct ? (
        <Link
          href={item.href}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold text-foreground ring-1 ring-border hover:bg-accent"
          target={item.external ? "_blank" : undefined}
          rel={item.external ? "noopener noreferrer" : undefined}
        >
          {item.cta}
          {item.external ? <ExternalLink className="h-4 w-4" /> : null}
        </Link>
      ) : (
        <span className="inline-flex items-center whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground ring-1 ring-border">
          Somente admin
        </span>
      )}
    </div>
  )
}

export function OnboardingChecklist({
  siteSlug,
  isAdmin,
  hasSiteConfigured,
  hasAnyProperty,
  hasPublishedProperty,
  hasSiteLead,
  hasDomainReady,
  initialCollapsed,
}: {
  siteSlug: string | null
  isAdmin: boolean
  hasSiteConfigured: boolean
  hasAnyProperty: boolean
  hasPublishedProperty: boolean
  hasSiteLead: boolean
  hasDomainReady: boolean
  initialCollapsed: boolean
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const autoCollapsedRef = useRef(false)

  useEffect(() => {
    setCollapsed(initialCollapsed)
  }, [initialCollapsed])

  const persistCollapsed = useCallback(
    async (next: boolean) => {
      if (!isAdmin) return
      try {
        await fetch("/api/onboarding/collapse", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ collapsed: next }),
        })
      } catch {
        // Non-blocking persistence: UI state should remain responsive.
      }
    },
    [isAdmin]
  )

  const items = useMemo<Item[]>(
    () => [
      {
        done: hasSiteConfigured,
        title: "Configurar marca e contato",
        description: isAdmin
          ? "Defina nome da marca, WhatsApp e e-mail no site."
          : "Peça ao admin da sua organização para configurar o site.",
        href: "/settings/site#site-section-brand",
        cta: "Ir para Configurações do Site",
        adminOnlyAction: true,
      },
      {
        done: hasPublishedProperty,
        title: "Publicar primeiro imóvel",
        description: "Cadastre um imóvel e deixe visível no site.",
        href: hasAnyProperty ? "/properties/publish" : "/properties/new",
        cta: hasAnyProperty ? "Ir para Publicação" : "Cadastrar primeiro imóvel",
      },
      {
        done: hasSiteLead,
        title: "Enviar 1 lead de teste",
        description: "Use a página de contato pública e confirme o lead no CRM.",
        href: siteSlug ? `/s/${encodeURIComponent(siteSlug)}/contact` : "/contacts/site",
        cta: "Testar lead agora",
        external: Boolean(siteSlug),
      },
      {
        done: hasDomainReady,
        title: "Conectar domínio próprio",
        description: "Opcional por enquanto. Você pode fazer isso depois.",
        href: "/settings/site#site-section-domain",
        cta: "Conectar domínio",
        adminOnlyAction: true,
        optional: true,
      },
    ],
    [hasAnyProperty, hasDomainReady, hasPublishedProperty, hasSiteConfigured, hasSiteLead, isAdmin, siteSlug]
  )

  const doneCount = items.filter((i) => i.done).length
  const requiredItems = items.filter((item) => !item.optional)
  const requiredDoneCount = requiredItems.filter((item) => item.done).length
  const readyForSales = requiredDoneCount === requiredItems.length

  useEffect(() => {
    if (!isAdmin || autoCollapsedRef.current) return
    if (!readyForSales || collapsed) return

    autoCollapsedRef.current = true
    setCollapsed(true)
    void persistCollapsed(true)
  }, [readyForSales, collapsed, isAdmin, persistCollapsed])

  const handleToggle = () => {
    const next = !collapsed
    setCollapsed(next)
    void persistCollapsed(next)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Primeiros 10 minutos</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {doneCount}/{items.length} concluídos
          </p>
          <div className="mt-2 h-2 w-44 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.round((doneCount / items.length) * 100)}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {siteSlug ? (
            <Link
              href={`/s/${encodeURIComponent(siteSlug)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:underline"
            >
              Abrir site
              <ExternalLink className="h-4 w-4" />
            </Link>
          ) : null}
          <Button variant="outline" size="sm" onClick={handleToggle}>
            {collapsed ? "Expandir" : "Recolher"}
            {collapsed ? <ChevronDown className="ml-1 h-4 w-4" /> : <ChevronUp className="ml-1 h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="text-sm text-muted-foreground">
          {readyForSales
            ? "CRM pronto para vender. Se quiser, conecte o domínio próprio depois."
            : "Complete estes passos para publicar o site e começar a captar leads."}
        </div>
        {!collapsed ? (
          <div className="grid gap-3">
            {items.map((item) => (
              <ItemRow key={item.title} item={item} canAct={!item.adminOnlyAction || isAdmin} />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
