'use client'

import { useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2, Upload, AlertTriangle, CheckCircle2 } from "lucide-react"
import Papa from "papaparse"

type ImportSummary = {
    total: number
    created: number
    updated: number
    errors: number
}

type MappedProperty = {
    external_id: string
    title: string
    description: string
    price: number
    type: string
    status: string
    address: Record<string, string>
    features: Record<string, number>
    images: string[]
    hide_from_site: boolean
}


function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
}

export function PropertyImportCsv() {
    const { user, role, organizationId } = useAuth()
    const supabase = useMemo(() => createClient(), [])

    const [csvFile, setCsvFile] = useState<File | null>(null)
    const [isParsing, setIsParsing] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [progress, setProgress] = useState({ current: 0, total: 0 })
    const [summary, setSummary] = useState<ImportSummary | null>(null)

    const [data, setData] = useState<MappedProperty[] | null>(null)
    const [preview, setPreview] = useState<{
        total: number
        sample: Array<{ external_id: string; title: string; price: number; type: string }>
    } | null>(null)

    const isAdmin = role === "owner" || role === "manager"
    const canPreview = !!csvFile && !isParsing && !isImporting
    const canImport = !!preview && !!data && !isParsing && !isImporting

    const resetOutputs = () => {
        setPreview(null)
        setSummary(null)
        setProgress({ current: 0, total: 0 })
        setData(null)
    }

    const handlePreview = () => {
        if (!csvFile) return

        setIsParsing(true)
        resetOutputs()

        Papa.parse(csvFile, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                setIsParsing(false)

                if (results.errors && results.errors.length > 0) {
                    toast.error(`Erro ao processar CSV: ${results.errors[0].message}`)
                    return
                }

                const rows = results.data as Record<string, string>[]
                // Transform and validate rows here in preview
                const mapped = rows.map((r, idx) => {
                    return {
                        external_id: r.external_id || r.id || `csv-${Date.now()}-${idx}`,
                        title: r.title || r.titulo || "Imóvel Sem Título",
                        description: r.description || r.descricao || "",
                        price: Number(r.price || r.preco || 0),
                        type: r.type || r.tipo || "house",
                        status: r.status || "available",
                        address: {
                            street: r.street || r.rua || "",
                            number: r.number || r.numero || "",
                            neighborhood: r.neighborhood || r.bairro || "",
                            city: r.city || r.cidade || "",
                            state: r.state || r.estado || "",
                            zip_code: r.zip_code || r.cep || "",
                        },
                        features: {
                            bedrooms: Number(r.bedrooms || r.quartos || 0),
                            bathrooms: Number(r.bathrooms || r.banheiros || 0),
                            suites: Number(r.suites || 0),
                            parking_spaces: Number(r.parking_spaces || r.vagas || 0),
                            area_total: Number(r.area_total || 0),
                            area_useful: Number(r.area_useful || r.area_util || 0),
                        },
                        images: [], // CSV image import could be added later
                        hide_from_site: true // Always hide by default
                    }
                })

                setData(mapped)
                setPreview({
                    total: mapped.length,
                    sample: mapped.slice(0, 5).map((m) => ({
                        external_id: m.external_id,
                        title: m.title,
                        price: m.price,
                        type: m.type,
                    })),
                })

                toast.success("Preview gerado. Pronto para importar.")
            },
            error: (error) => {
                setIsParsing(false)
                console.error("CSV Parse Error", error)
                toast.error(`Erro no parse do CSV: ${error.message}`)
            }
        })
    }

    const getExistingPublishedMap = async (orgId: string): Promise<Map<string, boolean>> => {
        const published = new Map<string, boolean>()
        let offset = 0
        const pageSize = 1000

        while (true) {
            const { data, error } = await supabase
                .from("properties")
                .select("external_id, hide_from_site")
                .eq("organization_id", orgId)
                .not("external_id", "is", null)
                .range(offset, offset + pageSize - 1)

            if (error) throw error
            if (!data || data.length === 0) break

            for (const row of data as Array<{ external_id: string | null; hide_from_site: boolean | null }>) {
                if (!row.external_id) continue
                published.set(row.external_id, row.hide_from_site === false)
            }

            if (data.length < pageSize) break
            offset += pageSize
        }

        return published
    }

    const handleImport = async () => {
        if (!data || !organizationId || !user) return
        if (!isAdmin) {
            toast.error("Apenas owner/manager podem importar.")
            return
        }

        setIsImporting(true)
        setSummary(null)

        try {
            const orgId = organizationId
            const publishedMap = await getExistingPublishedMap(orgId)

            const payloads = data.map((mapped) => {
                const alreadyPublished = publishedMap.get(mapped.external_id) === true
                return {
                    ...mapped,
                    organization_id: orgId,
                    hide_from_site: alreadyPublished ? false : true,
                }
            })

            setProgress({ current: 0, total: payloads.length })
            const batches = chunk(payloads, 20)

            let created = 0
            let updated = 0
            let errors = 0

            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i]

                for (const row of batch) {
                    if (row.external_id && publishedMap.has(row.external_id)) updated++
                    else created++
                }

                const controller = new AbortController()
                const t = setTimeout(() => controller.abort(), 90_000)

                const { error } = await supabase
                    .from("properties")
                    .upsert(batch, { onConflict: "organization_id,external_id" })
                    .abortSignal(controller.signal)

                clearTimeout(t)

                if (error) {
                    errors += batch.length
                    console.error("Import batch error:", error)
                }

                const done = Math.min((i + 1) * 20, payloads.length)
                setProgress({ current: done, total: payloads.length })
                await new Promise((r) => setTimeout(r, 0))
            }

            setSummary({
                total: payloads.length,
                created,
                updated,
                errors,
            })

            toast.success("Importação concluída.")
            if (errors > 0) {
                toast.error("Alguns lotes falharam.")
            }
        } catch (err) {
            console.error("Import error:", err)
            toast.error(err instanceof Error ? err.message : "Erro ao importar.")
        } finally {
            setIsImporting(false)
        }
    }

    return (
        <div className="space-y-6">
            {!isAdmin ? (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4" />
                        <div>
                            Apenas <span className="font-medium">owner/manager</span> podem importar imóveis.
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                    <div className="text-sm font-medium">Arquivo (CSV)</div>
                    <Input
                        type="file"
                        accept=".csv,text/csv"
                        disabled={isParsing || isImporting}
                        onChange={(e) => {
                            setCsvFile(e.target.files?.[0] ?? null)
                            resetOutputs()
                        }}
                    />
                    <div className="text-xs text-muted-foreground">
                        O arquivo deve conter cabeçalhos na primeira linha.
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Button onClick={handlePreview} disabled={!canPreview}>
                    {isParsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Gerar preview
                </Button>
                <Button variant="default" onClick={handleImport} disabled={!canImport || !isAdmin || !organizationId}>
                    {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Importar agora
                </Button>
                <Link href="/properties">
                    <Button variant="outline" disabled={isParsing || isImporting}>Voltar</Button>
                </Link>
            </div>

            {preview ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Preview</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div className="flex flex-wrap gap-3">
                            <div className="rounded-md border px-3 py-2">
                                Total: <span className="font-medium">{preview.total}</span>
                            </div>
                            <div className="rounded-md border px-3 py-2">
                                Publicação: <span className="font-medium">importa oculto</span> (você publica depois)
                            </div>
                        </div>

                        <div className="text-xs text-muted-foreground">
                            Amostra (primeiros {preview.sample.length}):
                        </div>
                        <div className="space-y-2">
                            {preview.sample.map((s) => (
                                <div key={s.external_id} className="rounded-md border bg-muted/20 px-3 py-2">
                                    <div className="font-medium">{s.title}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {s.external_id} · {s.type} · R$ {Math.round(s.price).toLocaleString("pt-BR")}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            {isImporting ? (
                <div className="space-y-2">
                    <div className="text-sm font-medium">Importando...</div>
                    <div className="h-2 w-full overflow-hidden rounded bg-muted">
                        <div
                            className="h-full"
                            style={{
                                width: progress.total ? `${Math.round((progress.current / progress.total) * 100)}%` : "0%",
                                backgroundColor: "hsl(var(--primary))",
                            }}
                        />
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {progress.current} de {progress.total}
                    </div>
                </div>
            ) : null}

            {summary ? (
                <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                    <div className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
                        <div className="space-y-1">
                            <div className="font-medium">Importação finalizada</div>
                            <div className="text-muted-foreground">
                                Total: {summary.total} · Criados: {summary.created} · Atualizados: {summary.updated} · Erros: {summary.errors}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Os imóveis entram <span className="font-medium">ocultos do site</span>.
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
