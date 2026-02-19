'use client'

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Loader2, CheckSquare, Square, Eye, EyeOff, ExternalLink } from "lucide-react"

type Row = {
  id: string
  title: string
  price: number | null
  type: string | null
  status: string | null
  hide_from_site: boolean | null
  external_id: string | null
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function formatMoneyBRL(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0)
}

function typeLabel(t?: string | null) {
  if (!t) return "-"
  if (t === "apartment") return "Apartamento"
  if (t === "house") return "Casa"
  if (t === "land") return "Terreno"
  if (t === "commercial") return "Comercial"
  return t
}

function statusLabel(s?: string | null) {
  if (!s) return "-"
  if (s === "available") return "Disponível"
  if (s === "sold") return "Vendido"
  if (s === "rented") return "Alugado"
  return s
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

  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([k]) => k)
  const hiddenCount = rows.filter((r) => r.hide_from_site).length
  const publishedCount = rows.length - hiddenCount

  const allSelected = rows.length > 0 && rows.every((r) => selected[r.id])

  const load = async () => {
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
        .select("id,title,price,type,status,hide_from_site,external_id")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(2000)

      if (onlyHidden) q = q.eq("hide_from_site", true)
      if (status !== "all") q = q.eq("status", status)
      if (search.trim()) {
        const raw = search.trim()
        const s = sanitizeForOrIlike(raw)
        const digits = s.replace(/[^0-9]/g, "")

        const ors: string[] = []
        if (s) {
          ors.push(`title.ilike.%${s}%`)
          ors.push(`external_id.ilike.%${s}%`)
        }
        if (digits && digits !== s) {
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
      setRows((data as Row[]) ?? [])
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
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

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

  const applyVisibility = async (hide_from_site: boolean) => {
    if (!isAdmin) {
      toast.error("Apenas owner/manager podem publicar.")
      return
    }
    if (!organizationId) return
    if (selectedIds.length === 0) return

    setSaving(true)
    try {
      const batches = chunk(selectedIds, 200)
      for (const ids of batches) {
        const { error } = await supabase
          .from("properties")
          .update({ hide_from_site })
          .in("id", ids)
          .eq("organization_id", organizationId)

        if (error) throw error
      }

      toast.success(hide_from_site ? "Imóveis ocultados do site." : "Imóveis publicados no site.")
      await load()
    } catch (err) {
      console.error("Bulk publish save error:", err)
      toast.error("Erro ao salvar. Tente novamente.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {!isAdmin ? (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          Você precisa ser <span className="font-medium">owner/manager</span> para publicar imóveis em massa.
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
              <div className="text-xs text-muted-foreground">Buscar por título, código ou UUID</div>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ex.: Apartamento, 77848263, univen:..., UUID" />
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
                  Todos
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Visibilidade</div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={onlyHidden ? "default" : "outline"}
                  onClick={() => setOnlyHidden(true)}
                >
                  Ocultos
                </Button>
                <Button
                  type="button"
                  variant={!onlyHidden ? "default" : "outline"}
                  onClick={() => setOnlyHidden(false)}
                >
                  Todos
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
              Mostrando <span className="font-medium">{rows.length}</span> imóveis (limite 2000).
            </div>
            <Badge variant="outline" className="text-xs">
              Publicados: {publishedCount}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Ocultos: {hiddenCount}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={toggleAll} disabled={rows.length === 0 || loading || saving}>
          {allSelected ? <CheckSquare className="mr-2 h-4 w-4" /> : <Square className="mr-2 h-4 w-4" />}
          {allSelected ? "Desmarcar todos" : "Selecionar todos"}
        </Button>
        <Button
          type="button"
          onClick={() => applyVisibility(false)}
          disabled={!isAdmin || selectedIds.length === 0 || loading || saving}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
          Publicar selecionados ({selectedIds.length})
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => applyVisibility(true)}
          disabled={!isAdmin || selectedIds.length === 0 || loading || saving}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <EyeOff className="mr-2 h-4 w-4" />}
          Ocultar selecionados
        </Button>
      </div>

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
            <div className="p-6 text-sm text-muted-foreground">Nenhum imóvel encontrado para os filtros atuais.</div>
          ) : (
            rows.map((r) => (
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
                    {r.external_id ? r.external_id : `ID: ${r.id.slice(0, 8)}`}
                  </div>
                </div>
                <div className="text-sm">{formatMoneyBRL(typeof r.price === "number" ? r.price : 0)}</div>
                <div className="text-sm">{typeLabel(r.type)}</div>
                <div className="text-sm">{statusLabel(r.status)}</div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={r.hide_from_site ? "outline" : "secondary"}
                    className={r.hide_from_site ? "text-xs" : "text-xs bg-emerald-100 text-emerald-800 border-emerald-200"}
                  >
                    {r.hide_from_site ? "Site: Oculto" : "Site: Publicado"}
                  </Badge>
                  <Link href={`/properties/${r.id}`} className="text-xs underline inline-flex items-center gap-1">
                    Editar <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
