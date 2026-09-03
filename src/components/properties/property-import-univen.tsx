'use client'

import { useState } from "react"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2, Upload, AlertTriangle, CheckCircle2 } from "lucide-react"
import { mapUnivenRowToProperty, type UnivenRow } from "@/lib/importers/univen"
import type { PropertyImportBatchSummary } from "@/lib/types"

type ImportSummary = {
  total: number
  created: number
  updated: number
  errors: number
}

function parseXmlTables(xmlText: string): UnivenRow[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, "text/xml")
  const parseErr = doc.getElementsByTagName("parsererror")[0]
  if (parseErr) {
    throw new Error("XML inválido ou malformado.")
  }

  const tables = Array.from(doc.getElementsByTagName("Table"))
  return tables.map((t) => {
    const row: UnivenRow = {}
    for (const child of Array.from(t.children)) {
      row[child.tagName] = child.textContent ?? ""
    }
    return row
  })
}

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const u of urls) {
    const url = (u || "").trim()
    if (!url) continue
    if (seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export function PropertyImportUniven() {
  const { role } = useAuth()

  const [imoveisFile, setImoveisFile] = useState<File | null>(null)
  const [fotosFiles, setFotosFiles] = useState<File[]>([])

  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [prepared, setPrepared] = useState<Array<ReturnType<typeof mapUnivenRowToProperty> extends infer T ? Exclude<T, null> : never> | null>(null)
  const [preview, setPreview] = useState<{
    total: number
    withPhotos: number
    photoFiles: string[]
    photosHint?: string
    sample: Array<{ external_id: string; title: string; price: number; type: string }>
  } | null>(null)

  const isAdmin = role === "owner" || role === "manager"

  const canPreview = !!imoveisFile && !isParsing && !isImporting
  const canImport = !!preview && !isParsing && !isImporting

  const resetOutputs = () => {
    setPreview(null)
    setSummary(null)
    setProgress({ current: 0, total: 0 })
    setPrepared(null)
    setImportError(null)
  }

  const buildPhotosMap = async (files: File[]): Promise<Map<string, string[]>> => {
    const map = new Map<string, Array<{ order: number; url: string }>>()

    for (const file of files) {
      const xml = await file.text()
      const rows = parseXmlTables(xml)

      for (const r of rows) {
        const id = (r.fkimovel || "").toString().trim()
        if (!id) continue
        const url = (r.original || r.url || r.miniatura || "").toString().trim()
        if (!url) continue
        const order = Number((r.ordem || "0").toString().trim()) || 0
        const list = map.get(id) ?? []
        list.push({ order, url })
        map.set(id, list)
      }
    }

    const out = new Map<string, string[]>()
    for (const [id, items] of map.entries()) {
      items.sort((a, b) => a.order - b.order)
      out.set(id, dedupeUrls(items.map((i) => i.url)))
    }
    return out
  }

  const persistBatch = async (
    items: Array<ReturnType<typeof mapUnivenRowToProperty> extends infer T ? Exclude<T, null> : never>
  ): Promise<PropertyImportBatchSummary> => {
    const response = await fetch("/api/properties/import-batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ items }),
    })

    const payload = (await response.json()) as
      | { ok: true; summary: PropertyImportBatchSummary }
      | { ok: false; message?: string; summary?: PropertyImportBatchSummary }

    if (!response.ok || !payload.ok) {
      const message = "message" in payload ? payload.message : undefined
      throw new Error(message || "Não foi possível persistir o lote de importação.")
    }

    return payload.summary
  }

  const handlePreview = async () => {
    if (!imoveisFile) return

    setIsParsing(true)
    resetOutputs()
    try {
      const imoveisText = await imoveisFile.text()
      const imoveisRows = parseXmlTables(imoveisText)

      const photosMap = fotosFiles.length ? await buildPhotosMap(fotosFiles) : new Map<string, string[]>()

      const mapped = imoveisRows
        .map((r) => {
          const pk = (r.pkimovel || "").toString().trim()
          const images = pk ? (photosMap.get(pk) ?? []) : []
          return mapUnivenRowToProperty(r, images)
        })
        .filter(Boolean) as Array<ReturnType<typeof mapUnivenRowToProperty> extends infer T ? Exclude<T, null> : never>

      const withPhotos = mapped.filter((m) => (m.images?.length || 0) > 0).length
      const photoFiles = fotosFiles.map((f) => f.name)
      const rate = mapped.length > 0 ? withPhotos / mapped.length : 0
      const photosHint =
        fotosFiles.length === 0
          ? undefined
          : withPhotos === 0
            ? "Nenhum imóvel veio com fotos. No Univen, selecione o XML de fotos (ex.: fotos_914949.xml). Se você tiver também fotos arquivadas, pode selecionar mais de um arquivo."
            : rate < 0.2
              ? "Poucas fotos foram vinculadas. Isso costuma indicar que você selecionou o XML de fotos errado (ex.: fotos_arquivados_XXXX.xml). Tente selecionar também o fotos_XXXX.xml (não arquivado)."
              : undefined
      const sample = mapped.slice(0, 5).map((m) => ({
        external_id: m.external_id,
        title: m.title,
        price: m.price,
        type: m.type,
      }))

      setPrepared(mapped)
      setPreview({
        total: mapped.length,
        withPhotos,
        photoFiles,
        photosHint,
        sample,
      })

      toast.success("Preview gerado. Pronto para importar.")
    } catch (err) {
      console.error("Preview error:", err)
      toast.error(err instanceof Error ? err.message : "Erro ao gerar preview.")
    } finally {
      setIsParsing(false)
    }
  }

  const handleImport = async () => {
    if (!imoveisFile) return
    if (!isAdmin) {
      toast.error("Apenas gestores podem importar.")
      return
    }

    setIsImporting(true)
    setSummary(null)
    setImportError(null)
    try {
      // Reuse the prepared mapping from preview to avoid re-parsing large XMLs during import.
      // If the user skipped preview, fall back to parsing now.
      let mappedRows = prepared
      if (!mappedRows) {
        const imoveisText = await imoveisFile.text()
        const imoveisRows = parseXmlTables(imoveisText)
        const photosMap = fotosFiles.length ? await buildPhotosMap(fotosFiles) : new Map<string, string[]>()
        mappedRows = imoveisRows
          .map((r) => {
            const pk = (r.pkimovel || "").toString().trim()
            const images = pk ? (photosMap.get(pk) ?? []) : []
            return mapUnivenRowToProperty(r, images)
          })
          .filter(Boolean) as Array<ReturnType<typeof mapUnivenRowToProperty> extends infer T ? Exclude<T, null> : never>
      }

      setProgress({ current: 0, total: mappedRows.length })

      const batches = chunk(mappedRows, 20)
      let created = 0
      let updated = 0
      let errors = 0
      let firstBatchError: string | null = null

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]

        try {
          const batchSummary = await persistBatch(batch)
          created += batchSummary.createdCount
          updated += batchSummary.updatedCount
          errors += batchSummary.errorCount
        } catch (error) {
          errors += batch.length
          const message = error instanceof Error ? error.message : "Não foi possível importar um lote."
          console.error("Import batch error:", error)
          if (!firstBatchError) firstBatchError = message
        }

        const done = Math.min((i + 1) * 20, mappedRows.length)
        setProgress({ current: done, total: mappedRows.length })

        // Yield to keep UI responsive on big imports.
        await new Promise((r) => setTimeout(r, 0))
      }

      const s: ImportSummary = {
        total: mappedRows.length,
        created,
        updated,
        errors,
      }
      setSummary(s)
      if (firstBatchError) {
        setImportError(firstBatchError)
      }
      toast.success("Importação concluída. Seus imóveis estão no CRM.")
      if (errors > 0) {
        toast.error(firstBatchError || "Alguns lotes falharam. Você pode tentar importar novamente para completar.")
      }
    } catch (err) {
      console.error("Import error:", err)
      const message = err instanceof Error ? err.message : "Erro ao importar."
      setImportError(message)
      toast.error(message)
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
              Apenas gestores podem importar imóveis.
              {role ? <span className="ml-1">Seu papel atual: <span className="font-medium">{role}</span>.</span> : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm font-medium">Arquivo de imóveis (XML)</div>
          <Input
            type="file"
            accept=".xml,text/xml"
            disabled={isParsing || isImporting}
            onChange={(e) => {
              setImoveisFile(e.target.files?.[0] ?? null)
              resetOutputs()
            }}
          />
          <div className="text-xs text-muted-foreground">
            Ex.: <span className="font-mono">imoveis_914949.xml</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Arquivo(s) de fotos (XML) (opcional)</div>
          <Input
            type="file"
            accept=".xml,text/xml"
            disabled={isParsing || isImporting}
            onChange={(e) => {
              setFotosFiles(e.target.files ? Array.from(e.target.files) : [])
              resetOutputs()
            }}
            multiple
          />
          <div className="text-xs text-muted-foreground">
            Ex.: <span className="font-mono">fotos_914949.xml</span> (você pode selecionar mais de um, como <span className="font-mono">fotos_arquivados_914949.xml</span>)
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handlePreview} disabled={!canPreview}>
          {isParsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Gerar preview
        </Button>
        <Button variant="default" onClick={handleImport} disabled={!canImport || !isAdmin}>
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
                Com fotos: <span className="font-medium">{preview.withPhotos}</span>
              </div>
              <div className="rounded-md border px-3 py-2">
                Publicação: <span className="font-medium">importa oculto</span> (você publica depois)
              </div>
            </div>

            {preview.photoFiles.length ? (
              <div className="text-xs text-muted-foreground">
                Arquivo(s) de fotos: <span className="font-mono">{preview.photoFiles.join(", ")}</span>
              </div>
            ) : null}

            {preview.photosHint ? (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  <div>{preview.photosHint}</div>
                </div>
              </div>
            ) : null}

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

      {importError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {importError}
        </div>
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
                Os imóveis entram <span className="font-medium">ocultos do site</span>. Para publicar, use{" "}
                <span className="font-medium">Publicar em massa</span> ou edite o imóvel e desmarque “Ocultar do site”.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
