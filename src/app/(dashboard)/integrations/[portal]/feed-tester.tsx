"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

type FeedTestState =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "ok"
      propertiesCount: number
      preview: string
      contentType: string | null
      bytes: number
    }
  | { kind: "error"; message: string }

async function logRun(payload: {
  portal: string
  status: "ok" | "error"
  properties_count: number
  bytes: number
  content_type: string | null
  message: string | null
}) {
  try {
    await fetch("/api/integrations/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
  } catch {
    // Best-effort only.
  }
}

function countOccurrences(haystack: string, needle: string) {
  if (!needle) return 0
  let count = 0
  let idx = 0
  while (true) {
    const next = haystack.indexOf(needle, idx)
    if (next === -1) return count
    count++
    idx = next + needle.length
  }
}

export function FeedTester({ feedUrl, portal }: { feedUrl: string; portal: string }) {
  const [state, setState] = useState<FeedTestState>({ kind: "idle" })

  const canTest = useMemo(() => Boolean(feedUrl), [feedUrl])

  const run = async () => {
    if (!feedUrl) return
    setState({ kind: "loading" })

    try {
      const res = await fetch(feedUrl, { cache: "no-store" })
      if (!res.ok) {
        if (res.status === 404) {
          setState({
            kind: "error",
            message:
              "Feed não encontrado. Ative a publicação e clique em Salvar para gerar a URL do feed.",
          })
          await logRun({
            portal,
            status: "error",
            properties_count: 0,
            bytes: 0,
            content_type: res.headers.get("content-type"),
            message: "Feed não encontrado (404)",
          })
          return
        }

        setState({
          kind: "error",
          message: `Não foi possível gerar o feed agora (status ${res.status}). Tente novamente em alguns instantes.`,
        })
        await logRun({
          portal,
          status: "error",
          properties_count: 0,
          bytes: 0,
          content_type: res.headers.get("content-type"),
          message: `HTTP ${res.status}`,
        })
        return
      }

      const contentType = res.headers.get("content-type")
      const txt = await res.text()
      const bytes = new TextEncoder().encode(txt).byteLength

      const isXmlish =
        txt.trimStart().startsWith("<?xml") ||
        txt.trimStart().startsWith("<feed") ||
        txt.includes("<properties>")

      if (!isXmlish) {
        setState({
          kind: "error",
          message:
            "O feed respondeu, mas o conteúdo não parece XML. Verifique a integração ou tente novamente.",
        })
        await logRun({
          portal,
          status: "error",
          properties_count: 0,
          bytes,
          content_type: contentType,
          message: "Conteúdo não parece XML",
        })
        return
      }

      const propertiesCount =
        countOccurrences(txt, "<property ") + countOccurrences(txt, "<property>")

      const previewLines = txt.split(/\r?\n/).slice(0, 30).join("\n")
      setState({
        kind: "ok",
        propertiesCount,
        preview: previewLines,
        contentType,
        bytes,
      })

      await logRun({
        portal,
        status: "ok",
        properties_count: propertiesCount,
        bytes,
        content_type: contentType,
        message: null,
      })
    } catch {
      setState({
        kind: "error",
        message:
          "Falha ao buscar o feed. Verifique sua conexão e tente novamente.",
      })
      await logRun({
        portal,
        status: "error",
        properties_count: 0,
        bytes: 0,
        content_type: null,
        message: "Falha ao buscar o feed",
      })
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Testar feed</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={run}
            disabled={!canTest || state.kind === "loading"}
          >
            {state.kind === "loading" ? "Testando..." : "Testar agora"}
          </Button>
          {feedUrl ? (
            <Button asChild variant="outline">
              <a href={feedUrl} target="_blank" rel="noreferrer">
                Abrir XML
              </a>
            </Button>
          ) : null}
          {feedUrl ? (
            <Button asChild variant="outline">
              <a href={feedUrl} download>
                Baixar XML
              </a>
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {state.kind === "idle" ? (
          <div className="text-sm text-muted-foreground">
            Clique em “Testar agora” para validar se a URL do feed está respondendo
            e gerar um preview.
          </div>
        ) : null}

        {state.kind === "error" ? (
          <div className="text-sm">
            <Badge variant="destructive">Erro</Badge>
            <div className="mt-2 text-muted-foreground">{state.message}</div>
          </div>
        ) : null}

        {state.kind === "ok" ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">OK</Badge>
              <span className="text-muted-foreground">
                Imóveis no feed: <span className="font-medium">{state.propertiesCount}</span>
              </span>
              <span className="text-muted-foreground">
                Tamanho: <span className="font-medium">{state.bytes}</span> bytes
              </span>
              {state.contentType ? (
                <span className="text-muted-foreground">
                  Content-Type: <span className="font-medium">{state.contentType}</span>
                </span>
              ) : null}
            </div>

            {state.propertiesCount === 0 ? (
              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <div>
                  O feed está válido, mas sem imóveis. Verifique filtros (somente
                  disponíveis / somente com fotos) ou cadastre imóveis.
                </div>
                <Link href={`/integrations/${portal}/report`}>
                  <Button variant="outline" size="sm">Ver pendências</Button>
                </Link>
              </div>
            ) : null}

            <pre className="max-h-72 overflow-auto rounded-md border bg-muted/20 p-3 text-xs">
              {state.preview}
            </pre>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
