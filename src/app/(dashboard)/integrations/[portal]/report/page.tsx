import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PORTALS, PORTAL_LABEL, type PortalIntegrationIssueRow, type PortalIntegrationRunRow, type PortalKey } from "@/lib/integrations"
import { revalidatePath } from "next/cache"

type PropertyRowForIssues = {
    id: string
    title: string | null
    description: string | null
    price: number | null
    type: string | null
    status: string | null
    images: string[] | null
    address: { city?: string | null; state?: string | null; zip?: string | null } | null
    hide_from_site: boolean | null
}

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

    async function analyzeIssuesAction() {
        "use server"
        const supabase = await createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id, role")
            .eq("id", user.id)
            .single()

        const role = (profile?.role as string | null) ?? null
        const canManage = role === "owner" || role === "manager"
        const organizationId = profile?.organization_id ?? null
        if (!canManage || !organizationId) return

        const portalKey: PortalKey = portal as PortalKey

        const { data: integration } = await supabase
            .from("portal_integrations")
            .select("config")
            .eq("organization_id", organizationId)
            .eq("portal", portalKey)
            .maybeSingle()

        const config = (integration?.config ?? {}) as Record<string, unknown>
        const sendOnlyAvailable = Boolean(config["send_only_available"] ?? true)
        const sendOnlyWithPhotos = Boolean(config["send_only_with_photos"] ?? true)

        const { data: properties } = await supabase
            .from("properties")
            .select("id,title,description,price,type,status,images,address,features,hide_from_site")
            .eq("organization_id", organizationId)

        const rows = (properties as PropertyRowForIssues[] | null) ?? []

        const nextIssues: Omit<PortalIntegrationIssueRow, "id" | "created_at" | "resolved_at" | "is_resolved">[] = []

        const hiddenCount = rows.filter((p) => p.hide_from_site === true).length
        const visibleRows = rows.filter((p) => p.hide_from_site !== true)

        if (visibleRows.length === 0 && hiddenCount > 0) {
            nextIssues.push({
                organization_id: organizationId,
                portal: portalKey,
                property_id: null,
                severity: "warning",
                issue_key: "all_hidden",
                message_human: "Nenhum imóvel entra no feed porque todos estão como “Oculto do site”. Publique em massa para liberar a exportação.",
                message_technical: null,
            })
        }

        for (const p of visibleRows) {
            const title = String(p.title ?? "")
            const desc = p.description == null ? "" : String(p.description)
            const price = Number(p.price ?? 0)
            const type = String(p.type ?? "")
            const status = String(p.status ?? "")
            const images = Array.isArray(p.images) ? p.images : []
            const city = p.address?.city ?? ""
            const state = p.address?.state ?? ""
            const zip = p.address?.zip ?? ""

            const wouldBeExcludedByStatus = sendOnlyAvailable && status !== "available"
            const wouldBeExcludedByPhotos = sendOnlyWithPhotos && images.length === 0

            const add = (severity: "blocker" | "warning", key: string, message: string) => {
                nextIssues.push({
                    organization_id: organizationId,
                    portal: portalKey,
                    property_id: String(p.id),
                    severity,
                    issue_key: key,
                    message_human: message,
                    message_technical: null,
                })
            }

            if (wouldBeExcludedByStatus) {
                add("warning", "excluded_status", `O imóvel '${title}' não entra no feed porque está com status '${status}'.`)
            }
            if (wouldBeExcludedByPhotos) {
                add("blocker", "missing_photos", `O imóvel '${title}' não pode ser publicado porque não tem fotos.`)
            }

            if (!Number.isFinite(price) || price <= 0) {
                add("blocker", "missing_price", `O imóvel '${title}' não pode ser publicado porque falta o preço.`)
            }
            if (!type || type.trim().length === 0) {
                add("blocker", "missing_type", `O imóvel '${title}' não pode ser publicado porque falta o tipo do imóvel.`)
            }
            if (!city || !state) {
                add("blocker", "missing_city_state", `O imóvel '${title}' não pode ser publicado porque falta Cidade e/ou UF no endereço.`)
            }
            if (!title || title.trim().length < 5) {
                add("blocker", "short_title", `O imóvel '${title || "Sem título"}' não pode ser publicado porque o título é muito curto.`)
            }

            if (!desc || desc.trim().length === 0) {
                add("warning", "missing_description", `O imóvel '${title}' está sem descrição. Isso pode reduzir a performance no portal.`)
            }

            if (images.length > 0 && images.length < 3) {
                add("warning", "few_photos", `O imóvel '${title}' tem poucas fotos. Recomendado adicionar pelo menos 3.`)
            }

            if (!zip) {
                add("warning", "missing_zip", `O imóvel '${title}' está sem CEP. Isso pode reduzir a qualidade do anúncio.`)
            }
        }

        // MVP: replace the set each time (simple + deterministic).
        await supabase
            .from("portal_integration_issues")
            .delete()
            .eq("organization_id", organizationId)
            .eq("portal", portalKey)

        if (nextIssues.length > 0) {
            await supabase.from("portal_integration_issues").insert(nextIssues.map((i) => ({
                ...i,
                is_resolved: false,
            })))
        }

        const blockers = nextIssues.filter((i) => i.severity === "blocker").length
        const warnings = nextIssues.filter((i) => i.severity === "warning").length
        await supabase.from("portal_integration_runs").insert({
            organization_id: organizationId,
            portal: portalKey,
            kind: "sync",
            status: "ok",
            properties_count: nextIssues.length,
            bytes: 0,
            content_type: null,
            message: `Análise de pendências: ${blockers} bloqueiam, ${warnings} recomendadas.`,
        })

        revalidatePath(`/integrations/${portalKey}/report`)
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
                            {canManage ? (
                                <form action={analyzeIssuesAction}>
                                    <Button type="submit" variant="outline" size="sm">
                                        Analisar pendências
                                    </Button>
                                </form>
                            ) : null}
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
