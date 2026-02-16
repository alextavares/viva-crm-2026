import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { PORTALS, PORTAL_LABEL, type PortalIntegrationRow, type PortalKey } from "@/lib/integrations"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { FeedTester } from "./feed-tester"

async function getOrigin() {
    const h = await headers()
    const proto = h.get("x-forwarded-proto") ?? "http"
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3015"
    return `${proto}://${host}`
}

function asBool(v: FormDataEntryValue | null) {
    return v === "on" || v === "true" || v === "1"
}

function pickStr(v: FormDataEntryValue | null, fallback = "") {
    return typeof v === "string" ? v : fallback
}

export default async function IntegrationPortalPage({
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

    const role = (profile?.role as string | null) ?? null
    const canManage = role === "owner" || role === "manager"
    const organizationId = profile?.organization_id ?? null

    let integration: PortalIntegrationRow | null = null
    if (organizationId) {
        const { data } = await supabase
            .from("portal_integrations")
            .select("*")
            .eq("organization_id", organizationId)
            .eq("portal", portal)
            .maybeSingle()
        integration = (data as PortalIntegrationRow | null) ?? null
    }

    const config = (integration?.config ?? {}) as Record<string, unknown>
    const exportEnabled = Boolean(config["export_enabled"])
    const feedToken = typeof config["feed_token"] === "string" ? (config["feed_token"] as string) : ""
    const origin = await getOrigin()
    const feedUrl = feedToken ? `${origin}/api/feeds/${portal}/${feedToken}` : ""

    const assignment = (config["lead_assignment"] as string | undefined) ?? "by_property"
    const assignmentFallback = (config["lead_assignment_fallback"] as string | undefined) ?? "owner_manager"
    const slaMinutes = Number(config["sla_minutes"] ?? 15)

    async function saveAction(formData: FormData) {
        "use server"
        const supabase = await createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const portal = pickStr(formData.get("portal"))
        if (!PORTALS.includes(portal as PortalKey)) return

        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id, role")
            .eq("id", user.id)
            .single()

        const role = (profile?.role as string | null) ?? null
        const canManage = role === "owner" || role === "manager"
        const organizationId = profile?.organization_id ?? null
        if (!canManage || !organizationId) return

        const enabled = asBool(formData.get("enabled"))
        const exportEnabled = asBool(formData.get("export_enabled"))
        const sendOnlyAvailable = asBool(formData.get("send_only_available"))
        const sendOnlyWithPhotos = asBool(formData.get("send_only_with_photos"))

        const leadAssignment = pickStr(formData.get("lead_assignment"), "by_property")
        const leadAssignmentFallback = pickStr(formData.get("lead_assignment_fallback"), "owner_manager")
        const slaMinutes = Number(pickStr(formData.get("sla_minutes"), "15"))

        // Token used to serve a public feed URL for portals. Treat as secret-like.
        const existingFeedToken = pickStr(formData.get("existing_feed_token"))
        const feedToken =
            enabled && exportEnabled
                ? (existingFeedToken || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
                : existingFeedToken

        const nextConfig = {
            export_enabled: exportEnabled,
            send_only_available: sendOnlyAvailable,
            send_only_with_photos: sendOnlyWithPhotos,
            feed_token: feedToken,
            lead_assignment: leadAssignment,
            lead_assignment_fallback: leadAssignmentFallback,
            sla_minutes: Number.isFinite(slaMinutes) ? slaMinutes : 15,
        }

        const now = new Date().toISOString()

        await supabase
            .from("portal_integrations")
            .upsert(
                {
                    organization_id: organizationId,
                    portal,
                    status: enabled ? "active" : "inactive",
                    config: nextConfig,
                    updated_at: now,
                },
                { onConflict: "organization_id,portal" }
            )

        revalidatePath("/integrations")
        revalidatePath(`/integrations/${portal}`)
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">{PORTAL_LABEL[portal as PortalKey]}</h1>
                    <p className="text-muted-foreground">
                        Conecte o portal em poucos passos. A configuração avançada ficará disponível depois.
                    </p>
                </div>
                <Link href="/integrations">
                    <Button variant="outline">Voltar</Button>
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Conectar portal</CardTitle>
                    <CardDescription>
                        {canManage
                            ? "MVP: salve regras e habilite o conector. Segredos não ficam no browser."
                            : "Apenas owner/manager pode conectar ou editar integrações."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {!organizationId ? (
                        <div className="text-sm text-muted-foreground">
                            Sua conta não tem organização vinculada, então não é possível configurar integrações.
                        </div>
                    ) : (
                        <form action={saveAction} className="space-y-6">
                            <input type="hidden" name="portal" value={portal} />
                            <input type="hidden" name="existing_feed_token" value={feedToken} />

                            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                                <div>
                                    <div className="font-medium">Ativar integração</div>
                                    <div className="text-xs text-muted-foreground">
                                        Liga/desliga o conector e mantém as configurações salvas.
                                    </div>
                                </div>
                                <input name="enabled" type="checkbox" defaultChecked={integration?.status === "active"} disabled={!canManage} />
                            </div>

                            <div className="space-y-3 rounded-md border p-3">
                                <div>
                                    <div className="font-medium">Envio de imóveis (Feed)</div>
                                    <div className="text-xs text-muted-foreground">
                                        A URL do feed é pública e deve ser tratada como “link privado”.
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-4">
                                    <Label className="text-sm">Ativar publicação</Label>
                                    <input name="export_enabled" type="checkbox" defaultChecked={exportEnabled} disabled={!canManage} />
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <Label className="text-sm">Somente disponíveis</Label>
                                        <input
                                            name="send_only_available"
                                            type="checkbox"
                                            defaultChecked={Boolean(config["send_only_available"] ?? true)}
                                            disabled={!canManage}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <Label className="text-sm">Somente com fotos</Label>
                                        <input
                                            name="send_only_with_photos"
                                            type="checkbox"
                                            defaultChecked={Boolean(config["send_only_with_photos"] ?? true)}
                                            disabled={!canManage}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-sm">URL do feed</Label>
                                    <Input readOnly value={feedUrl || "Salve para gerar a URL do feed"} />
                                    <div className="text-xs text-muted-foreground">
                                        Se você rotacionar esse link no futuro, o portal precisará ser atualizado.
                                    </div>
                                </div>
                            </div>

                            {canManage ? <FeedTester feedUrl={feedUrl} portal={portal} /> : null}

                            <div className="space-y-3 rounded-md border p-3">
                                <div>
                                    <div className="font-medium">Recebimento de leads</div>
                                    <div className="text-xs text-muted-foreground">
                                        MVP: regras de atribuição e SLA. Conectores reais serão ativados por portal.
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label className="text-sm">Atribuição padrão</Label>
                                        <select
                                            name="lead_assignment"
                                            defaultValue={assignment}
                                            disabled={!canManage}
                                            className="border-input bg-transparent w-full rounded-md border px-3 py-2 text-sm"
                                        >
                                            <option value="by_property">Por imóvel (responsável)</option>
                                            <option value="round_robin">Round-robin</option>
                                            <option value="owner_manager">Owner/Manager</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm">Fallback (se não achar responsável)</Label>
                                        <select
                                            name="lead_assignment_fallback"
                                            defaultValue={assignmentFallback}
                                            disabled={!canManage}
                                            className="border-input bg-transparent w-full rounded-md border px-3 py-2 text-sm"
                                        >
                                            <option value="owner_manager">Owner/Manager</option>
                                            <option value="round_robin">Round-robin</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm">SLA (alertar sem resposta)</Label>
                                        <select
                                            name="sla_minutes"
                                            defaultValue={String(slaMinutes)}
                                            disabled={!canManage}
                                            className="border-input bg-transparent w-full rounded-md border px-3 py-2 text-sm"
                                        >
                                            <option value="5">5 min</option>
                                            <option value="15">15 min</option>
                                            <option value="60">1 hora</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2">
                                <Link href={`/integrations/${portal}/report`}>
                                    <Button variant="outline" type="button">Ver relatório</Button>
                                </Link>
                                <Button type="submit" disabled={!canManage}>Salvar</Button>
                            </div>
                        </form>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Atalhos</CardTitle>
                    <CardDescription>Relatórios e pendências humanas.</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                    <Link href={`/integrations/${portal}/report`}>
                        <Button variant="outline">Abrir relatório</Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
    )
}
