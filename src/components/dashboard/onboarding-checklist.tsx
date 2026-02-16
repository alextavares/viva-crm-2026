import Link from "next/link"
import { CheckCircle2, Circle, ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Item = {
  done: boolean
  title: string
  description: string
  href: string
  cta: string
  external?: boolean
}

function ItemRow({ item }: { item: Item }) {
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
      <Link
        href={item.href}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold text-foreground ring-1 ring-border hover:bg-accent"
        target={item.external ? "_blank" : undefined}
        rel={item.external ? "noopener noreferrer" : undefined}
      >
        {item.cta}
        {item.external ? <ExternalLink className="h-4 w-4" /> : null}
      </Link>
    </div>
  )
}

export function OnboardingChecklist({
  siteSlug,
  isAdmin,
  hasSiteConfigured,
  hasProperty,
  hasPublishedProperty,
  hasLead,
}: {
  siteSlug: string | null
  isAdmin: boolean
  hasSiteConfigured: boolean
  hasProperty: boolean
  hasPublishedProperty: boolean
  hasLead: boolean
}) {
  const items: Item[] = [
    {
      done: hasSiteConfigured,
      title: "Configurar seu site",
      description: isAdmin
        ? "Defina marca, WhatsApp, email e banners."
        : "Peça ao admin da sua organização para configurar o site.",
      href: isAdmin ? "/settings/site" : "/settings",
      cta: isAdmin ? "Configurar" : "Ver acesso",
    },
    {
      done: hasProperty && hasPublishedProperty,
      title: "Publicar seu primeiro imóvel",
      description: "Cadastre um imóvel e deixe visível no site.",
      href: "/properties/new",
      cta: "Cadastrar",
    },
    {
      done: hasLead,
      title: "Receber seu primeiro lead",
      description: "Teste o formulário do site ou WhatsApp e veja o lead aparecer em Contatos.",
      href: "/contacts",
      cta: "Ver contatos",
    },
  ]

  const allDone = items.every((i) => i.done)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Primeiros 10 minutos</CardTitle>
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
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="text-sm text-muted-foreground">
          {allDone
            ? "Perfeito. Seu site e CRM estão prontos para vender."
            : "Complete estes passos para publicar seu site e começar a capturar leads."}
        </div>
        <div className="grid gap-3">
          {items.map((item) => (
            <ItemRow key={item.title} item={item} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

