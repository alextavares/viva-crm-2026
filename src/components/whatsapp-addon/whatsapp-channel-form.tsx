"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type ChannelSettings = {
  provider: "meta"
  operation_mode: "live" | "sandbox"
  display_phone: string | null
  business_account_id: string | null
  phone_number_id: string | null
  webhook_verify_token: string | null
  access_token_last4: string | null
  status: "disconnected" | "connected" | "error"
  last_error_message: string | null
  last_tested_at: string | null
}

type Props = {
  canManage: boolean
  tableReady: boolean
  addonEnabled: boolean
  initial: ChannelSettings
  webhookToken: string | null
}

const SAVE_TIMEOUT_MS = 45_000
const SAVE_WATCHDOG_MS = 60_000

function normalizeStatus(status: string | null | undefined): "disconnected" | "connected" | "error" {
  if (status === "connected" || status === "error") return status
  return "disconnected"
}

function statusMeta(status: "disconnected" | "connected" | "error") {
  if (status === "connected") {
    return { label: "Conectado", className: "border-emerald-300 bg-emerald-50 text-emerald-700" }
  }
  if (status === "error") {
    return { label: "Erro", className: "border-rose-300 bg-rose-50 text-rose-700" }
  }
  return { label: "Desconectado", className: "border-amber-300 bg-amber-50 text-amber-700" }
}

function maskToken(value: string | null | undefined) {
  if (!value) return "Não configurado"
  if (value.length <= 8) return value
  return `${value.slice(0, 4)}••••${value.slice(-4)}`
}

export function WhatsAppChannelForm({ canManage, tableReady, addonEnabled, initial, webhookToken }: Props) {
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [origin, setOrigin] = useState("")
  const [operationMode, setOperationMode] = useState<"live" | "sandbox">(initial.operation_mode === "sandbox" ? "sandbox" : "live")
  const [accessTokenLast4, setAccessTokenLast4] = useState(initial.access_token_last4 || null)
  const [displayPhone, setDisplayPhone] = useState(initial.display_phone || "")
  const [businessAccountId, setBusinessAccountId] = useState(initial.business_account_id || "")
  const [phoneNumberId, setPhoneNumberId] = useState(initial.phone_number_id || "")
  const [webhookVerifyToken, setWebhookVerifyToken] = useState(initial.webhook_verify_token || "")
  const [accessToken, setAccessToken] = useState("")
  const [status, setStatus] = useState<"disconnected" | "connected" | "error">(normalizeStatus(initial.status))
  const [lastErrorMessage, setLastErrorMessage] = useState(initial.last_error_message || "")
  const [lastTestedAt, setLastTestedAt] = useState(initial.last_tested_at || null)
  const accessTokenMask = accessTokenLast4 ? `••••••••${accessTokenLast4}` : "Não configurado"

  const statusInfo = useMemo(() => statusMeta(status), [status])
  const inboundWebhookUrl = useMemo(() => {
    if (!webhookToken) return null
    const path = `/api/webhooks/whatsapp/${webhookToken}?provider=meta`
    return origin ? `${origin}${path}` : path
  }, [origin, webhookToken])
  const activationChecklist = useMemo(
    () => [
      {
        label: "Add-on habilitado",
        done: addonEnabled,
      },
      {
        label: "Modo operacional definido",
        done: Boolean(operationMode),
      },
      {
        label: "Webhook inbound provisionado",
        done: Boolean(webhookToken),
      },
      {
        label: "Credenciais de produção preenchidas",
        done:
          operationMode === "sandbox" ||
          (businessAccountId.trim().length >= 3 &&
            phoneNumberId.trim().length >= 3 &&
            webhookVerifyToken.trim().length >= 6 &&
            (accessToken.trim().length >= 20 || initial.access_token_last4)),
      },
    ],
    [accessToken, addonEnabled, businessAccountId, initial.access_token_last4, operationMode, phoneNumberId, webhookToken, webhookVerifyToken]
  )
  const isBusy = isSaving || isTesting
  const uiBlocked = !canManage || !tableReady || isBusy || !addonEnabled

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin)
    }
  }, [])

  async function withTimeout<T>(promise: Promise<T>, ms = SAVE_TIMEOUT_MS): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        const err = new Error("RequestTimeout")
        err.name = "TimeoutError"
        reject(err)
      }, ms)
    })

    try {
      return await Promise.race([promise, timeoutPromise])
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }

  const save = async () => {
    if (uiBlocked) return
    setIsSaving(true)
    const uiWatchdog = setTimeout(() => {
      setIsSaving(false)
      toast.error("Demorou demais para salvar o canal. Tente novamente.")
    }, SAVE_WATCHDOG_MS)

    try {
      const response = await withTimeout(
        fetch("/api/settings/whatsapp-channel", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({
            provider: "meta",
            operation_mode: operationMode,
            display_phone: displayPhone,
            business_account_id: businessAccountId,
            phone_number_id: phoneNumberId,
            webhook_verify_token: webhookVerifyToken,
            access_token: accessToken,
          }),
        })
      )

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        channel?: { access_token_last4?: string | null }
      }
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.message || "Falha ao salvar canal.")
      }

      setStatus("disconnected")
      setLastErrorMessage("")
      setLastTestedAt(null)
      setAccessTokenLast4(payload.channel?.access_token_last4 || accessToken.slice(-4) || null)
      setAccessToken("")
      toast.success("Canal salvo. Agora clique em “Testar conexão”.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar canal."
      toast.error(message)
    } finally {
      clearTimeout(uiWatchdog)
      setIsSaving(false)
    }
  }

  const testConnection = async () => {
    if (uiBlocked) return
    setIsTesting(true)
    const uiWatchdog = setTimeout(() => {
      setIsTesting(false)
      toast.error("Demorou demais para testar conexão. Tente novamente.")
    }, SAVE_WATCHDOG_MS)

    try {
      const response = await withTimeout(
        fetch("/api/settings/whatsapp-channel/test", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          cache: "no-store",
        })
      )

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        status?: "disconnected" | "connected" | "error"
        message?: string
      }

      const nextStatus = normalizeStatus(payload.status)
      setStatus(nextStatus)
      setLastTestedAt(new Date().toISOString())

      if (response.ok && payload.ok) {
        setLastErrorMessage("")
        toast.success(payload.message || "Conexão validada com sucesso.")
      } else {
        setLastErrorMessage(payload.message || "Não foi possível validar a conexão.")
        toast.error(payload.message || "Não foi possível validar a conexão.")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao testar conexão."
      setStatus("error")
      setLastErrorMessage(message)
      toast.error(message)
    } finally {
      clearTimeout(uiWatchdog)
      setIsTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      {!tableReady ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Migração pendente: execute a migration do canal WhatsApp no Supabase para habilitar esta seção.
        </div>
      ) : null}

      {!addonEnabled ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Add-on WhatsApp desativado para esta organização.{" "}
          <Link href="/settings/whatsapp-addon" className="font-medium underline">
            Ative o add-on primeiro
          </Link>{" "}
          para liberar conexão de canal.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Status do canal</div>
          <div className={`mt-2 inline-flex rounded-md border px-2 py-1 text-sm font-medium ${statusInfo.className}`}>
            {statusInfo.label}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Provedor</div>
          <div className="mt-2 text-2xl font-semibold">Meta WhatsApp</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Modo operacional</div>
          <div className="mt-2 text-2xl font-semibold">{operationMode === "sandbox" ? "Sandbox" : "Produção"}</div>
          <p className="text-xs text-muted-foreground">
            {operationMode === "sandbox" ? "Simula envios no CRM sem provedor externo." : "Usa provedor real (Meta)."}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Access token</div>
          <div className="mt-2 text-sm font-medium">{accessTokenMask}</div>
          <p className="text-xs text-muted-foreground">Token nunca é exibido em texto aberto.</p>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Inbound webhook</div>
            <p className="text-xs text-muted-foreground">URL pronta para configurar no provedor e token mascarado.</p>
          </div>
          <div className="text-xs text-muted-foreground">Token: {maskToken(webhookToken)}</div>
        </div>
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs break-all">{inboundWebhookUrl || "Salve um webhook verify token para provisionar a URL."}</div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="text-sm font-medium">Checklist de ativação</div>
        <div className="mt-3 space-y-2">
          {activationChecklist.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
              <span>{item.label}</span>
              <span className={item.done ? "text-emerald-700" : "text-amber-700"}>{item.done ? "OK" : "Pendente"}</span>
            </div>
          ))}
        </div>
      </div>

      {lastErrorMessage ? (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">{lastErrorMessage}</div>
      ) : null}

      <div className="rounded-lg border p-4">
        <div className="text-sm font-medium">Modo de operação</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant={operationMode === "live" ? "default" : "outline"}
            onClick={() => setOperationMode("live")}
            disabled={uiBlocked}
          >
            Produção
          </Button>
          <Button
            type="button"
            variant={operationMode === "sandbox" ? "default" : "outline"}
            onClick={() => setOperationMode("sandbox")}
            disabled={uiBlocked}
          >
            Sandbox
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Em sandbox, o botão normal de envio registra a mensagem no CRM sem chamar a Meta.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Telefone de exibição (opcional)</label>
          <Input
            value={displayPhone}
            onChange={(e) => setDisplayPhone(e.target.value)}
            placeholder="+55 11 99999-9999"
            disabled={uiBlocked}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Business Account ID</label>
          <Input
            value={businessAccountId}
            onChange={(e) => setBusinessAccountId(e.target.value)}
            placeholder="ex.: 123456789012345"
            disabled={uiBlocked}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Phone Number ID</label>
          <Input
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="ex.: 109876543210987"
            disabled={uiBlocked}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Webhook Verify Token</label>
          <Input
            value={webhookVerifyToken}
            onChange={(e) => setWebhookVerifyToken(e.target.value)}
            placeholder="token de validação do webhook"
            disabled={uiBlocked}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Access Token</label>
        <Input
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder="cole aqui para criar/atualizar o token"
          autoComplete="new-password"
          disabled={uiBlocked}
        />
      </div>

      {lastTestedAt ? (
        <p className="text-xs text-muted-foreground">
          Último teste: {new Date(lastTestedAt).toLocaleString("pt-BR")}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="button" onClick={save} disabled={uiBlocked}>
          {isSaving ? "Salvando..." : "Salvar canal"}
        </Button>
        <Button type="button" variant="outline" onClick={testConnection} disabled={uiBlocked}>
          {isTesting ? "Testando..." : "Testar conexão"}
        </Button>
      </div>
    </div>
  )
}
