import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { PORTALS, PORTAL_LABEL, type PortalIntegrationRow, type PortalKey } from "@/lib/integrations"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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

function buildFeedUrl(origin: string, portal: PortalKey, organizationSlug: string | null, feedToken: string) {
    if (!feedToken) return ""

    if (organizationSlug) {
        if (portal === "imovelweb") {
            return `${origin}/api/public/s/${organizationSlug}/imovelweb-xml?token=${feedToken}`
        }

        if (portal === "zap_vivareal") {
            return `${origin}/api/public/s/${organizationSlug}/zap-xml?token=${feedToken}`
        }
    }

    return `${origin}/api/feeds/${portal}/${feedToken}`
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
    let organizationSlug: string | null = null

    let integration: PortalIntegrationRow | null = null
    if (organizationId) {
        const { data: organization } = await supabase
            .from("organizations")
            .select("slug")
            .eq("id", organizationId)
            .maybeSingle()

        organizationSlug = organization?.slug ?? null

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
    const feedUrl = buildFeedUrl(origin, portal as PortalKey, organizationSlug, feedToken)

    const assignment = (config["lead_assignment"] as string | undefined) ?? "by_property"
    const assignmentFallback = (config["lead_assignment_fallback"] as string | undefined) ?? "owner_manager"
    const slaMinutes = Number(config["sla_minutes"] ?? 15)
    const codigoImobiliaria = typeof config["codigo_imobiliaria"] === "string" ? (config["codigo_imobiliaria"] as string) : ""
    const tipoPublicacaoDefault = typeof config["tipo_publicacao_default"] === "string" ? (config["tipo_publicacao_default"] as string) : "SIMPLE"
    const defaultLocalidadeId = typeof config["default_localidade_id"] === "string" ? (config["default_localidade_id"] as string) : ""
    const nomeContato = typeof config["nome_contato"] === "string" ? (config["nome_contato"] as string) : ""
    const emailContato = typeof config["email_contato"] === "string" ? (config["email_contato"] as string) : ""
    const telefoneContato = typeof config["telefone_contato"] === "string" ? (config["telefone_contato"] as string) : ""
    const mostrarMapaConfig = config["mostrar_mapa"]
    const mostrarMapa =
        typeof mostrarMapaConfig === "string"
            ? mostrarMapaConfig.toUpperCase() === "EXATO"
                ? "EXACTO"
                : (mostrarMapaConfig as string)
            : mostrarMapaConfig === true
                ? "EXACTO"
                : "NO"
    const localidadeMappingsRaw =
        typeof config["localidade_mappings_raw"] === "string" ? (config["localidade_mappings_raw"] as string) : ""

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
        const codigoImobiliaria = pickStr(formData.get("codigo_imobiliaria"))
        const tipoPublicacaoDefault = pickStr(formData.get("tipo_publicacao_default"), "SIMPLE").toUpperCase()
        const defaultLocalidadeId = pickStr(formData.get("default_localidade_id"))
        const nomeContato = pickStr(formData.get("nome_contato"))
        const emailContato = pickStr(formData.get("email_contato"))
        const telefoneContato = pickStr(formData.get("telefone_contato"))
        const mostrarMapaRaw = pickStr(formData.get("mostrar_mapa"), "NO").toUpperCase()
        const normalizedMostrarMapa = mostrarMapaRaw === "EXATO" ? "EXACTO" : mostrarMapaRaw
        const mostrarMapa =
            normalizedMostrarMapa === "EXACTO" || normalizedMostrarMapa === "APROXIMADO" || normalizedMostrarMapa === "NO"
                ? normalizedMostrarMapa
                : "NO"
        const localidadeMappingsRaw = pickStr(formData.get("localidade_mappings_raw"))

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
            codigo_imobiliaria: codigoImobiliaria,
            tipo_publicacao_default: tipoPublicacaoDefault,
            default_localidade_id: defaultLocalidadeId,
            nome_contato: nomeContato,
            email_contato: emailContato,
            telefone_contato: telefoneContato,
            mostrar_mapa: mostrarMapa,
            localidade_mappings_raw: localidadeMappingsRaw,
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

                            {portal === "imovelweb" ? (
                                <div className="space-y-3 rounded-md border p-3">
                                    <div>
                                        <div className="font-medium">Configuração OpenNavent</div>
                                        <div className="text-xs text-muted-foreground">
                                            Esses campos alimentam o XML oficial exigido pelo Imovelweb.
                                        </div>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label className="text-sm" htmlFor="codigo_imobiliaria">Código da imobiliária</Label>
                                            <Input id="codigo_imobiliaria" name="codigo_imobiliaria" defaultValue={codigoImobiliaria} disabled={!canManage} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm" htmlFor="tipo_publicacao_default">Tipo de publicação padrão</Label>
                                            <select
                                                id="tipo_publicacao_default"
                                                name="tipo_publicacao_default"
                                                defaultValue={tipoPublicacaoDefault}
                                                disabled={!canManage}
                                                className="border-input bg-transparent w-full rounded-md border px-3 py-2 text-sm"
                                            >
                                                <option value="SIMPLE">Simple</option>
                                                <option value="DESTACADO">Destacado</option>
                                                <option value="HOME">Home</option>
                                                <option value="GRATIS">Gratis</option>
                                                <option value="ALQUILER_SIMPLE">Alquiler Simple</option>
                                                <option value="EXCLUSIVE">Exclusive</option>
                                                <option value="EXCLUSIVE_II">Exclusive II</option>
                                                <option value="DESARROLLOS_HOME">Desarrollos Home</option>
                                                <option value="DESARROLLOS_DESTACADO">Desarrollos Destacado</option>
                                                <option value="DESARROLLOS_SIMPLE">Desarrollos Simple</option>
                                                <option value="DESARROLLOS_GRATIS">Desarrollos Gratis</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm" htmlFor="default_localidade_id">ID de localidade padrão</Label>
                                            <Input id="default_localidade_id" name="default_localidade_id" defaultValue={defaultLocalidadeId} disabled={!canManage} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm" htmlFor="mostrar_mapa">Mostrar mapa</Label>
                                            <select
                                                id="mostrar_mapa"
                                                name="mostrar_mapa"
                                                defaultValue={mostrarMapa}
                                                disabled={!canManage}
                                                className="border-input bg-transparent w-full rounded-md border px-3 py-2 text-sm"
                                            >
                                                <option value="NO">Não mostrar</option>
                                                <option value="EXACTO">Exato</option>
                                                <option value="APROXIMADO">Aproximado</option>
                                            </select>
                                            <div className="text-xs text-muted-foreground">
                                                Valores oficiais do OpenNavent: <code>NO</code>, <code>EXACTO</code> e <code>APROXIMADO</code>. A documentação também cita <code>EXATO</code> como alias.
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm" htmlFor="nome_contato">Nome do contato</Label>
                                            <Input id="nome_contato" name="nome_contato" defaultValue={nomeContato} disabled={!canManage} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm" htmlFor="email_contato">Email do contato</Label>
                                            <Input id="email_contato" name="email_contato" type="email" defaultValue={emailContato} disabled={!canManage} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm" htmlFor="telefone_contato">Telefone do contato</Label>
                                            <Input id="telefone_contato" name="telefone_contato" defaultValue={telefoneContato} disabled={!canManage} />
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <Label className="text-sm" htmlFor="localidade_mappings_raw">Mapa de localidade por cidade/UF</Label>
                                            <Textarea
                                                id="localidade_mappings_raw"
                                                name="localidade_mappings_raw"
                                                defaultValue={localidadeMappingsRaw}
                                                disabled={!canManage}
                                                className="min-h-[130px] font-mono text-xs"
                                            />
                                            <div className="text-xs text-muted-foreground">
                                                Uma linha por cidade ou bairro no formato <code>UF|Cidade=ID</code> ou <code>UF|Cidade|Bairro=ID</code>. Exemplo: <code>SP|São Sebastião|Maresias=V1-D-499784</code>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : null}

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
