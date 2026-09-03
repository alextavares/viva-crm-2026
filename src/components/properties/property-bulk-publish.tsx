'use client'

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Loader2, CheckSquare, Square, Eye, EyeOff, ExternalLink } from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"
import { buildPropertyFixHref, getPropertyPublishIssues, isPropertyPublishReady } from "@/lib/property-publish-readiness"
import { updateBulkPropertySiteVisibility } from "@/app/actions/properties"
import { getPropertyTypeLabel } from "@/lib/types"

type Row = {
  id: string
  public_code: string | null
  title: string
  description: string | null
  price: number | null
  type: string | null
  status: string | null
  hide_from_site: boolean | null
  address: {
    city?: string | null
    [key: string]: unknown
  } | null
  images: string[] | null
  image_paths: string[] | null
  external_id: string | null
}

function formatMoneyBRL(v: number | null | undefined) {
  if (!v || v <= 0) {
    return {
      label: "Sem preço",
      className: "text-red-700",
    }
  }

  return {
    label: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v),
    className: "",
  }
}

function typeLabel(t?: string | null) {
  return getPropertyTypeLabel(t)
}

function statusLabel(s?: string | null) {
  if (!s) return "Indefinido"
  if (s === "available") return "Disponível"
  if (s === "inactive") return "Inativo"
  if (s === "pending_approval") return "Aguardando aprovação"
  if (s === "sold") return "Vendido"
  if (s === "rented") return "Alugado"
  return s
}

function getSiteVisibility(row: Pick<Row, "status" | "hide_from_site">) {
  const visible = !row.hide_from_site && row.status === "available"

  return {
    visible,
    label: visible ? "Site: Publicado" : "Site: Oculto",
  }
}

function refLabel(row: Pick<Row, "id" | "public_code" | "external_id">) {
  const publicCode = row.public_code?.trim()
  if (publicCode) return publicCode

  const externalId = row.external_id?.trim()
  if (externalId) return externalId

  return row.id.slice(0, 8)
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim())
}

function sanitizeForOrIlike(v: string) {
  return v.replace(/[,%()]/g, " ").trim()
}

export function PropertyBulkPublish() {
  const { role, organizationId } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  const isAdmin = role === "owner" || role === "manager"

  const [rows, setRows] = useState<Row[]>([])
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<"available" | "all">("available")
  const [onlyHidden, setOnlyHidden] = useState(true)
  const [onlyPendingIssues, setOnlyPendingIssues] = useState(false)
  const debouncedSearch = useDebounce(search, 500)

  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([k]) => k)
  const hiddenCount = rows.filter((r) => !getSiteVisibility(r).visible).length
  const publishedCount = rows.length - hiddenCount
  const readinessById = useMemo(
    () => new Map(rows.map((row) => [row.id, getPropertyPublishIssues(row)])),
    [rows]
  )
  const rowById = useMemo(
    () => new Map(rows.map((row) => [row.id, row])),
    [rows]
  )
  const pendingCount = rows.filter((row) => {
    const issues = readinessById.get(row.id) ?? []
    return issues.length > 0 || row.status !== "available"
  }).length
  const readyCount = rows.filter((row) => isPropertyPublishReady(row) && row.status === "available").length
  const selectedBlockingCount = selectedIds.filter((id) =>
    (readinessById.get(id) ?? []).some((issue) => issue.severity === "blocking")
  ).length
  const selectedUnavailableCount = selectedIds.filter((id) => rowById.get(id)?.status !== "available").length
  const canPublishSelection =
    isAdmin &&
    selectedIds.length > 0 &&
    !loading &&
    !saving &&
    selectedBlockingCount === 0 &&
    selectedUnavailableCount === 0

  const allSelected = rows.length > 0 && rows.every((r) => selected[r.id])

  const load = useCallback(async () => {
    if (!organizationId) {
      setLastError("Organização ainda está carregando. Aguarde 2s e tente novamente.")
      return
    }
    setLoading(true)
    setLastError(null)
    try {
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 30_000)

      let q = supabase
        .from("properties")
        .select("id,public_code,title,description,price,type,status,hide_from_site,address,images,image_paths,external_id")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(2000)

      if (onlyHidden) q = q.eq("hide_from_site", true)
      if (status !== "all") q = q.eq("status", status)
      if (debouncedSearch.trim()) {
        const raw = debouncedSearch.trim()
        const s = sanitizeForOrIlike(raw)
        const digits = s.replace(/[^0-9]/g, "")

        const ors: string[] = []
        if (s) {
          ors.push(`title.ilike.%${s}%`)
          ors.push(`description.ilike.%${s}%`)
          ors.push(`public_code.ilike.%${s}%`)
          ors.push(`external_id.ilike.%${s}%`)
        }
        if (digits && digits !== s) {
          ors.push(`public_code.ilike.%${digits}%`)
          ors.push(`external_id.ilike.%${digits}%`)
        }
        if (isUuid(raw)) {
          ors.push(`id.eq.${raw}`)
        }
        if (ors.length > 0) q = q.or(ors.join(","))
      }

      const { data, error } = await q.abortSignal(controller.signal)
      clearTimeout(t)
      if (error) throw error
      const loadedRows = (data as Row[]) ?? []
      setRows(onlyPendingIssues ? loadedRows.filter((row) => getPropertyPublishIssues(row).length > 0) : loadedRows)
      setSelected({})
    } catch (err) {
      console.error("Bulk publish load error:", err)
      const msg =
        typeof err === "object" && err !== null && "name" in err && (err as { name?: unknown }).name === "AbortError"
          ? "Demorou demais para carregar. Tente novamente."
          : "Erro ao carregar imóveis. Tente novamente."
      setLastError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, onlyHidden, onlyPendingIssues, organizationId, status, supabase])

  useEffect(() => {
    void load()
  }, [load])

  const toggleAll = () => {
    if (rows.length === 0) return
    const next: Record<string, boolean> = {}
    if (!allSelected) {
      for (const r of rows) next[r.id] = true
    }
    setSelected(next)
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const resetFilters = () => {
    setSearch("")
    setStatus("available")
    setOnlyHidden(true)
    setOnlyPendingIssues(false)
  }

  const applyVisibility = async (hide_from_site: boolean) => {
    if (!isAdmin) {
      toast.error("Apenas gestores podem publicar.")
      return
    }
    if (!organizationId) return
    if (selectedIds.length === 0) return
    if (!hide_from_site && selectedBlockingCount > 0) {
      toast.error("Há imóveis selecionados com bloqueios de qualidade. Corrija antes de publicar.")
      return
    }
    if (!hide_from_site && selectedUnavailableCount > 0) {
      toast.error("Há imóveis selecionados que não estão disponíveis. Ajuste o status antes de publicar.")
      return
    }

    setSaving(true)
    setLastError(null)
    try {
      const result = await updateBulkPropertySiteVisibility({
        propertyIds: selectedIds,
        hideFromSite: hide_from_site,
      })

      if (!result.success) {
        setLastError(result.error)
        toast.error(result.error)
        return
      }

      toast.success(
        hide_from_site
          ? `${result.data?.updatedCount ?? selectedIds.length} imóvel(is) ocultado(s) do site.`
          : `${result.data?.updatedCount ?? selectedIds.length} imóvel(is) publicado(s) no site.`
      )
      await load()
    } catch (err) {
      console.error("Bulk publish save error:", err)
      const message = err instanceof Error ? err.message : "Erro ao salvar. Tente novamente."
      setLastError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {!isAdmin ? (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          Você precisa ser gestor para publicar imóveis em massa.
        </div>
      ) : null}

      {lastError ? (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          {lastError}
        </div>
      ) : null}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Buscar por título, código, referência ou UUID</div>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ex.: V-1200, Apartamento, 77848263, referência externa ou UUID" />
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={status === "available" ? "default" : "outline"}
                  onClick={() => setStatus("available")}
                >
                  Disponível
                </Button>
                <Button
                  type="button"
                  variant={status === "all" ? "default" : "outline"}
                  onClick={() => setStatus("all")}
                >
                  Todos os status
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Visibilidade no site</div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={onlyHidden ? "default" : "outline"}
                  onClick={() => setOnlyHidden(true)}
                >
                  Ocultos no site
                </Button>
                <Button
                  type="button"
                  variant={!onlyHidden ? "default" : "outline"}
                  onClick={() => setOnlyHidden(false)}
                >
                  Visíveis e ocultos
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Qualidade</div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={onlyPendingIssues ? "default" : "outline"}
                  onClick={() => setOnlyPendingIssues(true)}
                >
                  Com pendências
                </Button>
                <Button
                  type="button"
                  variant={!onlyPendingIssues ? "default" : "outline"}
                  onClick={() => setOnlyPendingIssues(false)}
                >
                  Com e sem pendências
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={load} disabled={loading || saving}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Atualizar lista
            </Button>
            <div className="text-xs text-muted-foreground">
              Mostrando <span className="font-medium">{rows.length}</span> imóveis nesta consulta.
            </div>
            <Badge variant="outline" className="text-xs">
              Visíveis no site: {publishedCount}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Ocultos no site: {hiddenCount}
            </Badge>
            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-800 border-emerald-200">
              Publicáveis: {readyCount}
            </Badge>
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-200">
              Exigem revisão: {pendingCount}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={toggleAll} disabled={rows.length === 0 || loading || saving}>
          {allSelected ? <CheckSquare className="mr-2 h-4 w-4" /> : <Square className="mr-2 h-4 w-4" />}
          {allSelected ? "Desmarcar todos" : "Selecionar todos"}
        </Button>
        {selectedIds.length > 0 ? (
          <Badge variant="outline" className="text-xs">
            Selecionados: {selectedIds.length}
          </Badge>
        ) : null}
        <Button
          type="button"
          onClick={() => applyVisibility(false)}
          disabled={!canPublishSelection}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
          {selectedIds.length > 0 ? `Publicar selecionados (${selectedIds.length})` : "Publicar selecionados"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => applyVisibility(true)}
          disabled={!isAdmin || selectedIds.length === 0 || loading || saving}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <EyeOff className="mr-2 h-4 w-4" />}
          {selectedIds.length > 0 ? `Ocultar selecionados (${selectedIds.length})` : "Ocultar selecionados"}
        </Button>
      </div>
      {selectedIds.length > 0 && !loading && !saving && !canPublishSelection ? (
        <div className="text-xs text-muted-foreground">
          {selectedBlockingCount > 0 ? (
            <span>{selectedBlockingCount} selecionado(s) ainda exigem correção antes de publicar.</span>
          ) : selectedUnavailableCount > 0 ? (
            <span>{selectedUnavailableCount} selecionado(s) ainda não estão disponíveis para publicação.</span>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[44px_1fr_140px_120px_120px_140px] gap-0 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <div />
          <div>Título</div>
          <div>Preço</div>
          <div>Tipo</div>
          <div>Status</div>
          <div>Site</div>
        </div>
        <div className="divide-y">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground flex flex-col gap-3">
              <div>Nenhum imóvel encontrado para os filtros atuais.</div>
              <div>
                <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                  Limpar filtros
                </Button>
              </div>
            </div>
          ) : (
            rows.map((r) => (
              (() => {
                const issues = readinessById.get(r.id) ?? []
                const blockingIssues = issues.filter((issue) => issue.severity === "blocking")
                const warningIssues = issues.filter((issue) => issue.severity === "warning")
                const hasIssues = issues.length > 0
                const firstIssue = blockingIssues[0] ?? warningIssues[0]
                const canPublishRow = blockingIssues.length === 0 && r.status === "available"
                const priceSummary = formatMoneyBRL(r.price)
                const siteVisibility = getSiteVisibility(r)

                return (
                  <div
                    key={r.id}
                    className="grid grid-cols-[44px_1fr_140px_120px_120px_140px] items-center gap-0 px-3 py-2 text-sm hover:bg-muted/20"
                  >
                    <div>
                      <input
                        type="checkbox"
                        checked={!!selected[r.id]}
                        onChange={() => toggleOne(r.id)}
                        aria-label={`Selecionar ${r.title}`}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.title}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {refLabel(r)}
                      </div>
                      {hasIssues ? (
                        <div className="space-y-1 pt-1 text-xs">
                          {blockingIssues.length > 0 ? (
                            <div className="truncate text-red-700">
                              Bloqueios: {blockingIssues.map((issue) => issue.label).join(" · ")}
                            </div>
                          ) : null}
                          {warningIssues.length > 0 ? (
                            <div className="truncate text-amber-800">
                              Avisos: {warningIssues.map((issue) => issue.label).join(" · ")}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className={`text-sm ${priceSummary.className}`}>{priceSummary.label}</div>
                    <div className="text-sm">{typeLabel(r.type)}</div>
                    <div className="text-sm">{statusLabel(r.status)}</div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={siteVisibility.visible ? "secondary" : "outline"}
                        className={siteVisibility.visible ? "text-xs bg-emerald-100 text-emerald-800 border-emerald-200" : "text-xs"}
                      >
                        {siteVisibility.label}
                      </Badge>
                      {blockingIssues.length > 0 ? (
                        <Badge variant="destructive" className="text-xs">
                          Corrigir bloqueios
                        </Badge>
                      ) : r.status !== "available" ? (
                        <Badge variant="outline" className="text-xs bg-slate-100 text-slate-700 border-slate-200">
                          Status impede publicação
                        </Badge>
                      ) : warningIssues.length > 0 ? (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-200">
                          Com aviso
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-800 border-emerald-200">
                          Publicável
                        </Badge>
                      )}
                      <Link
                        href={hasIssues && firstIssue ? buildPropertyFixHref(r.id, firstIssue.focusFieldId) : `/properties/${r.id}`}
                        className="text-xs underline inline-flex items-center gap-1"
                      >
                        {blockingIssues.length > 0 ? "Corrigir bloqueio" : warningIssues.length > 0 ? "Revisar aviso" : "Editar"} <ExternalLink className="h-3 w-3" />
                      </Link>
                      {r.hide_from_site && !canPublishRow ? (
                        <span className="text-[11px] text-red-700">
                          {blockingIssues.length > 0
                            ? "Não publica até corrigir bloqueios"
                            : "Não publica enquanto não estiver disponível"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                )
              })()
            ))
          )}
        </div>
      </div>
    </div>
  )
}
