import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PORTALS, PORTAL_LABEL, type PortalIntegrationIssueRow, type PortalIntegrationRunRow, type PortalKey } from "@/lib/integrations"
import { revalidatePath } from "next/cache"
import { getImovelwebReadinessIssues } from "@/lib/integrations/imovelweb-readiness"

type PropertyRowForIssues = {
    id: string
    title: string | null
    description: string | null
    price: number | null
    type: string | null
    status: string | null
    images: string[] | null
    image_paths: string[] | null
    address: {
        city?: string | null
        state?: string | null
        zip?: string | null
        street?: string | null
        full_address?: string | null
        neighborhood?: string | null
        lat?: number | null
        lng?: number | null
        [key: string]: unknown
    } | null
    hide_from_site: boolean | null
}

function buildGenericPortalIssues(
    properties: PropertyRowForIssues[],
    organizationId: string,
    portalKey: PortalKey,
    options: {
        sendOnlyAvailable: boolean
        sendOnlyWithPhotos: boolean
    }
): Omit<PortalIntegrationIssueRow, "id" | "created_at" | "resolved_at" | "is_resolved">[] {
    const nextIssues: Omit<PortalIntegrationIssueRow, "id" | "created_at" | "resolved_at" | "is_resolved">[] = []
    const hiddenCount = properties.filter((property) => property.hide_from_site === true).length
    const visibleRows = properties.filter((property) => property.hide_from_site !== true)

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

    for (const property of visibleRows) {
        const title = String(property.title ?? "")
        const description = property.description == null ? "" : String(property.description)
        const price = Number(property.price ?? 0)
        const type = String(property.type ?? "")
        const status = String(property.status ?? "")
        const images = Array.isArray(property.images) ? property.images : []
        const imagePaths = Array.isArray(property.image_paths) ? property.image_paths : []
        const photosCount = Math.max(images.length, imagePaths.length)
        const city = property.address?.city ?? ""
        const state = property.address?.state ?? ""
        const zip = property.address?.zip ?? ""
        const propertyLabel = title || "Sem título"

        const add = (severity: "blocker" | "warning", key: string, message: string) => {
            nextIssues.push({
                organization_id: organizationId,
                portal: portalKey,
                property_id: String(property.id),
                severity,
                issue_key: key,
                message_human: message,
                message_technical: null,
            })
        }

        if (options.sendOnlyAvailable && status !== "available") {
            add("warning", "excluded_status", `O imóvel '${propertyLabel}' não entra no feed porque está com status '${status}'.`)
        }

        if (options.sendOnlyWithPhotos && photosCount === 0) {
            add("blocker", "missing_photos", `O imóvel '${propertyLabel}' não pode ser publicado porque não tem fotos.`)
        }

        if (!Number.isFinite(price) || price <= 0) {
            add("blocker", "missing_price", `O imóvel '${propertyLabel}' não pode ser publicado porque falta o preço.`)
        }

        if (!type || type.trim().length === 0) {
            add("blocker", "missing_type", `O imóvel '${propertyLabel}' não pode ser publicado porque falta o tipo do imóvel.`)
        }

        if (!city || !state) {
            add("blocker", "missing_city_state", `O imóvel '${propertyLabel}' não pode ser publicado porque falta Cidade e/ou UF no endereço.`)
        }

        if (!title || title.trim().length < 5) {
            add("blocker", "short_title", `O imóvel '${propertyLabel}' não pode ser publicado porque o título é muito curto.`)
        }

        if (!description || description.trim().length === 0) {
            add("warning", "missing_description", `O imóvel '${propertyLabel}' está sem descrição. Isso pode reduzir a performance no portal.`)
        }

        if (photosCount > 0 && photosCount < 3) {
            add("warning", "few_photos", `O imóvel '${propertyLabel}' tem poucas fotos. Recomendado adicionar pelo menos 3.`)
        }

        if (!zip) {
            add("warning", "missing_zip", `O imóvel '${propertyLabel}' está sem CEP. Isso pode reduzir a qualidade do anúncio.`)
        }
    }

    return nextIssues
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
            .select("id,title,description,price,type,status,images,image_paths,address,features,hide_from_site")
            .eq("organization_id", organizationId)

        const rows = (properties as PropertyRowForIssues[] | null) ?? []

        const nextIssues: Omit<PortalIntegrationIssueRow, "id" | "created_at" | "resolved_at" | "is_resolved">[] =
            portalKey === "imovelweb"
                ? getImovelwebReadinessIssues(rows, config, {
                    sendOnlyAvailable,
                    sendOnlyWithPhotos,
                }).map((issue) => ({
                    organization_id: organizationId,
                    portal: portalKey,
                    property_id: issue.propertyId,
                    severity: issue.severity,
                    issue_key: issue.issueKey,
                    message_human: issue.messageHuman,
                    message_technical: null,
                }))
                : buildGenericPortalIssues(rows, organizationId, portalKey, {
                    sendOnlyAvailable,
                    sendOnlyWithPhotos,
                })

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
