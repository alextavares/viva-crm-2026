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
}

function ItemRow({ item, canAct }: { item: Item; canAct: boolean }) {
  const Icon = item.done ? CheckCircle2 : Circle

  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border bg-card/50 p-4">
      <div className="flex items-start gap-3">
        <Icon className={item.done ? "mt-0.5 h-5 w-5 text-emerald-500" : "mt-0.5 h-5 w-5 text-muted-foreground"} />
        <div>
          <div className="text-sm font-semibold">{item.title}</div>
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
  hasDomainReady,
  hasTrackingConfigured,
  hasProperty,
  hasPublishedProperty,
  hasLead,
  initialCollapsed,
}: {
  siteSlug: string | null
  isAdmin: boolean
  hasSiteConfigured: boolean
  hasDomainReady: boolean
  hasTrackingConfigured: boolean
  hasProperty: boolean
  hasPublishedProperty: boolean
  hasLead: boolean
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
        cta: "Configurar",
        adminOnlyAction: true,
      },
      {
        done: hasDomainReady,
        title: "Site pronto para abrir (domínio ou preview)",
        description: "Válido quando o domínio está verificado ou o preview já está disponível.",
        href: "/settings/site#site-section-domain",
        cta: "Ver domínio",
        adminOnlyAction: true,
      },
      {
        done: hasTrackingConfigured,
        title: "Ativar rastreamento de marketing",
        description: "Configure GA4, Meta Pixel ou Google Ads para medir conversão.",
        href: "/settings/site#site-section-tracking",
        cta: "Configurar tracking",
        adminOnlyAction: true,
      },
      {
        done: hasProperty && hasPublishedProperty,
        title: "Publicar primeiro imóvel",
        description: "Cadastre um imóvel e deixe visível no site.",
        href: hasProperty ? "/properties/publish" : "/properties/new",
        cta: hasProperty ? "Publicar em massa" : "Cadastrar imóvel",
      },
      {
        done: hasLead,
        title: "Receber primeiro lead",
        description: "Teste o formulário público e valide entrada em Contatos.",
        href: "/contacts",
        cta: "Abrir contatos",
      },
    ],
    [hasDomainReady, hasLead, hasProperty, hasPublishedProperty, hasSiteConfigured, hasTrackingConfigured, isAdmin]
  )

  const doneCount = items.filter((i) => i.done).length
  const allDone = doneCount === items.length

  useEffect(() => {
    if (!isAdmin || autoCollapsedRef.current) return
    if (!allDone || collapsed) return

    autoCollapsedRef.current = true
    setCollapsed(true)
    void persistCollapsed(true)
  }, [allDone, collapsed, isAdmin, persistCollapsed])

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
          {allDone
            ? "Perfeito. Seu site e CRM estão prontos para operação."
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

