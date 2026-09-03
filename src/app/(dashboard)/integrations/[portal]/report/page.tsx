import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PORTALS, PORTAL_LABEL, type PortalIntegrationIssueRow, type PortalIntegrationRunRow, type PortalKey } from "@/lib/integrations"
import { IntegrationReportActions } from "./integration-report-actions"

export default async function IntegrationPortalReportPage({
    params,
}: {
    params: Promise<{ portal: string }>
}) {
    const { portal } = await params
    if (!PORTALS.includes(portal as PortalKey)) return notFound()

    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id, role")
        .eq("id", user.id)
        .single()

    const organizationId = profile?.organization_id ?? null
    const role = (profile?.role as string | null) ?? null
    const canManage = role === "owner" || role === "manager"

    let runs: PortalIntegrationRunRow[] = []
    if (organizationId) {
        const { data } = await supabase
            .from("portal_integration_runs")
            .select("*")
            .eq("organization_id", organizationId)
            .eq("portal", portal)
            .order("created_at", { ascending: false })
            .limit(10)
        runs = (data as PortalIntegrationRunRow[] | null) ?? []
    }

    let issues: PortalIntegrationIssueRow[] = []
    if (organizationId) {
        const { data } = await supabase
            .from("portal_integration_issues")
            .select("*")
            .eq("organization_id", organizationId)
            .eq("portal", portal)
            .eq("is_resolved", false)
            .order("severity", { ascending: true })
            .order("created_at", { ascending: false })
            .limit(50)
        issues = (data as PortalIntegrationIssueRow[] | null) ?? []
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">Relatório: {PORTAL_LABEL[portal as PortalKey]}</h1>
                    <p className="text-muted-foreground">
                        Pendências humanas, sincronizações e leads recebidos.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href={`/integrations/${portal}`}>
                        <Button variant="outline">Voltar</Button>
                    </Link>
                    <Link href="/integrations">
                        <Button variant="outline">Integrações</Button>
                    </Link>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between gap-3">
                            Pendências
                            <IntegrationReportActions portal={portal as PortalKey} canManage={canManage} />
                        </CardTitle>
                        <CardDescription>Itens que bloqueiam publicação ou reduzem performance.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {issues.length === 0 ? (
                            <div className="text-sm text-muted-foreground">
                                Sem pendências registradas. Clique em “Analisar pendências”.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {issues.map((i) => (
                                    <div key={i.id} className="rounded-md border p-3 text-sm">
                                        <div className="font-medium">
                                            {i.severity === "blocker" ? "Bloqueia publicação" : "Recomendado"}
                                        </div>
                                        <div className="text-muted-foreground mt-1">{i.message_human}</div>
                                        {i.property_id ? (
                                            <div className="mt-2">
                                                <Link href={`/properties/${i.property_id}`}>
                                                    <Button variant="outline" size="sm">Corrigir agora</Button>
                                                </Link>
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Sincronizações</CardTitle>
                        <CardDescription>Histórico de execuções do conector.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {runs.length === 0 ? (
                            <div className="text-sm text-muted-foreground">
                                Nenhum teste/sincronização registrado ainda. Use “Testar feed” na tela do portal.
                            </div>
                        ) : (
                            <div className="space-y-2 text-sm">
                                {runs.map((r) => (
                                    <div key={r.id} className="flex items-start justify-between gap-3 border rounded-md p-3">
                                        <div className="space-y-1">
                                            <div className="font-medium">
                                                {r.kind === "test_feed" ? "Teste do feed" : "Sincronização"}{" "}
                                                {r.status === "ok" ? "OK" : "Erro"}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {new Date(r.created_at).toLocaleString("pt-BR")} · Imóveis: {r.properties_count} · {r.bytes} bytes
                                            </div>
                                            {r.message ? (
                                                <div className="text-xs text-muted-foreground">{r.message}</div>
                                            ) : null}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Leads recebidos</CardTitle>
                        <CardDescription>Leads do portal com SLA e atribuição.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Em breve: tabela com origem, imóvel, contato e tempo de resposta.
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
