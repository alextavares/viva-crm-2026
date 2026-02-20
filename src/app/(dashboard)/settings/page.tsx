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

  // Middleware should already redirect unauthenticated users,
  // but keep a safe fallback to avoid rendering a broken page.
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

  let org: OrgInfo | null = null
  if (organizationId) {
    const { data } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .eq("id", organizationId)
      .single()
    org = (data as OrgInfo) ?? null
  }

  const isAdmin = role === "owner" || role === "manager"

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">Configurações</h1>
        <p className="text-muted-foreground">
          Ajuste o site público, integrações e preferências da sua operação.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Site Público</CardTitle>
            <CardDescription>
              Configure marca, páginas e banners. O site recebe leads direto no CRM.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Link href="/settings/site" className={!isAdmin ? "pointer-events-none opacity-60" : ""}>
              <Button disabled={!isAdmin}>Configurar</Button>
            </Link>
            {org?.slug ? (
              <Link href={`/s/${org.slug}`} target="_blank" rel="noreferrer">
                <Button variant="outline">Abrir site</Button>
              </Link>
            ) : (
              <Button variant="outline" disabled>
                Abrir site
              </Button>
            )}
            {!isAdmin ? (
              <div className="text-xs text-muted-foreground">
                Apenas <span className="font-medium">owner/manager</span> podem editar o site.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>Importar Dados</CardTitle>
            <CardDescription>
              Migre imóveis do seu CRM antigo. Importações entram ocultas do site por padrão, com publicação intencional depois.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Link href="/properties/import" className={!isAdmin ? "pointer-events-none opacity-60" : ""}>
              <Button disabled={!isAdmin} variant="outline">
                Importar imóveis
              </Button>
            </Link>
            <Link href="/properties/publish" className={!isAdmin ? "pointer-events-none opacity-60" : ""}>
              <Button disabled={!isAdmin} variant="outline">
                Publicar em massa
              </Button>
            </Link>
            <div className="text-xs text-muted-foreground">
              Import de imóveis será <span className="font-medium">hide_from_site=true</span> por padrão, com publicação intencional depois.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Follow-up Automático</CardTitle>
            <CardDescription>
              Configure a régua de 5min, 24h e 3dias para não deixar lead esfriar.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Link href="/settings/followup" className={!isAdmin ? "pointer-events-none opacity-60" : ""}>
              <Button disabled={!isAdmin}>Configurar follow-up</Button>
            </Link>
            <div className="text-xs text-muted-foreground">
              Templates por organização e disparo automático para novos leads.
            </div>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>Distribuição de Leads + SLA</CardTitle>
            <CardDescription>
              Round-robin para brokers, SLA visível e redistribuição automática de leads parados.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Link href="/settings/leads" className={!isAdmin ? "pointer-events-none opacity-60" : ""}>
              <Button disabled={!isAdmin}>Configurar distribuição</Button>
            </Link>
            <div className="text-xs text-muted-foreground">
              Foco em resposta rápida e menos lead esquecido.
            </div>
          </CardContent>
        </Card>

      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Equipe</CardTitle>
            <CardDescription>Usuários, permissões e corretores.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled variant="outline">
              Em breve
            </Button>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>Cobrança</CardTitle>
            <CardDescription>Plano, assinaturas e notas.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled variant="outline">
              Em breve
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
