import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type OrgInfo = {
  id: string
  name: string
  slug: string
}

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold md:text-2xl">Configurações</h1>
        <p className="text-muted-foreground">Faça login para continuar.</p>
      </div>
    )
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  const organizationId = profile?.organization_id ?? null
  const role = (profile?.role as string | null) ?? null
  const isAdmin = role === "owner" || role === "manager"

  let org: OrgInfo | null = null
  if (organizationId) {
    const { data } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .eq("id", organizationId)
      .single()
    org = (data as OrgInfo) ?? null
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Configurações</h1>
          <p className="text-muted-foreground">
            Ajustes de site, portais, WhatsApp, equipe e cobrança ficam com os gestores da operação.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Seu espaço operacional</CardTitle>
            <CardDescription>
              Use os atalhos abaixo para continuar atendendo leads, visitas e negociações.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/contacts">Abrir contatos</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/appointments">Abrir agenda</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/ai-leads">Abrir Leads IA</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const sections = [
    {
      title: "Operação",
      description: "Regras de atendimento, metas e rotina comercial.",
      cards: [
        {
          title: "Follow-up automático",
          description: "Configure a régua de 5 min, 24 h e 3 dias para não deixar lead esfriar.",
          href: "/settings/followup",
          button: "Configurar follow-up",
        },
        {
          title: "Distribuição de leads e SLA",
          description: "Distribuição automática para corretores, prazo de resposta e redistribuição de leads parados.",
          href: "/settings/leads",
          button: "Configurar distribuição",
        },
        {
          title: "Metas do corretor",
          description: "Metas semanais ou mensais de captação, resposta rápida e visitas.",
          href: "/settings/goals",
          button: "Configurar metas",
        },
      ],
    },
    {
      title: "Site e portais",
      description: "Vitrine pública, importação de carteira e integrações de publicação.",
      cards: [
        {
          title: "Site público",
          description: "Configure marca, páginas e banners. O site recebe leads direto no CRM.",
          href: "/settings/site",
          button: "Configurar site",
          secondaryHref: org?.slug ? `/s/${org.slug}` : null,
          secondaryButton: "Abrir site",
        },
        {
          title: "Importar dados",
          description: "Migre imóveis do CRM antigo. Itens importados entram fora da vitrine pública até revisão.",
          href: "/properties/import",
          button: "Importar imóveis",
          secondaryHref: "/properties/publish",
          secondaryButton: "Publicar em massa",
        },
        {
          title: "Portais imobiliários",
          description: "Acompanhe prontidão, publicação e recebimento de leads dos portais conectados.",
          href: "/integrations",
          button: "Abrir integrações",
        },
      ],
    },
    {
      title: "WhatsApp e IA",
      description: "Canal oficial, add-on e pré-atendimento assistido.",
      cards: [
        {
          title: "WhatsApp add-on",
          description: "Defina ativação, quota mensal e política de uso do canal oficial.",
          href: "/settings/whatsapp-addon",
          button: "Configurar add-on",
        },
        {
          title: "Canal WhatsApp oficial",
          description: "Conecte Meta WhatsApp, teste o canal e acompanhe o status da conexão.",
          href: "/settings/whatsapp-channel",
          button: "Configurar canal",
        },
        {
          title: "Leads IA",
          description: "Acompanhe pré-atendimentos, qualificação e handoff para a equipe.",
          href: "/ai-leads",
          button: "Abrir fila IA",
        },
      ],
    },
    {
      title: "Conta",
      description: "Equipe, permissões e cobrança.",
      cards: [
        {
          title: "Equipe",
          description: "Usuários, permissões e corretores ativos da imobiliária.",
          href: "/settings/team",
          button: "Gerenciar equipe",
        },
        {
          title: "Cobrança",
          description: "Plano, assinatura e dados comerciais da conta.",
          href: "/settings/billing",
          button: "Gerenciar cobrança",
        },
      ],
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">Configurações</h1>
        <p className="text-muted-foreground">
          Ajuste a operação em grupos: atendimento, site e portais, WhatsApp/IA e conta.
        </p>
      </div>

      {sections.map((section) => (
        <section key={section.title} className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <p className="text-sm text-muted-foreground">{section.description}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {section.cards.map((card) => (
              <Card key={card.title} className="h-full">
                <CardHeader>
                  <CardTitle>{card.title}</CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2">
                  <Button asChild>
                    <Link href={card.href}>{card.button}</Link>
                  </Button>
                  {card.secondaryHref ? (
                    <Button asChild variant="outline">
                      <Link href={card.secondaryHref}>{card.secondaryButton}</Link>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
