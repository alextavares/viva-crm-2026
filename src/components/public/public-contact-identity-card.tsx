"use client"

import { Building2, MessageCircle, ShieldCheck, UserRound } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { buildWhatsAppUrl, digitsOnly } from "@/lib/whatsapp"

export type PublicContactIdentityState =
  | {
      mode: "broker"
      name: string
      avatarUrl?: string | null
      creci?: string | null
      whatsapp?: string | null
      responseTimeLabel?: string | null
      note?: string | null
      exampleLabel?: string | null
    }
  | {
      mode: "team"
      organizationName: string
      avatarUrl?: string | null
      whatsapp?: string | null
      note?: string | null
      exampleLabel?: string | null
    }

type Props = {
  state: PublicContactIdentityState
  theme?: string | null
  ctaMessage?: string | null
}

function getInitials(value: string) {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  if (parts.length === 0) return "VC"
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("")
}

function formatWhatsAppLabel(phone?: string | null) {
  const digits = digitsOnly(phone ?? "")
  if (!digits) return null

  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
  }

  if (digits.length === 12) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`
  }

  return phone ?? null
}

export function PublicContactIdentityCard({ state, theme, ctaMessage }: Props) {
  const isPremium = theme === "premium"
  const isBroker = state.mode === "broker"
  const whatsapp = isBroker ? state.whatsapp : state.whatsapp
  const whatsappHref = whatsapp
    ? buildWhatsAppUrl({
        phone: whatsapp,
        message: ctaMessage ?? null,
      })
    : null
  const whatsappLabel = formatWhatsAppLabel(whatsapp)

  return (
    <div className={`border bg-white ${isPremium ? "rounded-3xl p-5" : "rounded-2xl p-4"}`}>
      <div className="flex items-start gap-3">
        <Avatar size="lg" className="border bg-muted/40">
          {state.avatarUrl ? <AvatarImage src={state.avatarUrl} alt={isBroker ? state.name : state.organizationName} /> : null}
          <AvatarFallback>
            {isBroker ? <UserRound className="h-5 w-5" /> : getInitials(state.organizationName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {isBroker ? "Corretor responsável" : "Equipe da imobiliária"}
            </div>
            {state.exampleLabel ? (
              <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {state.exampleLabel}
              </span>
            ) : null}
          </div>
          <div className={isPremium ? "mt-1 text-lg font-semibold" : "mt-1 text-base font-semibold"}>
            {isBroker ? state.name : state.organizationName}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {isBroker ? "Atendimento com contexto do imóvel e condução segura pelo canal informado." : "Atendimento pelo WhatsApp informado e disponibilidade sob consulta."}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm">
        {isBroker ? (
          <>
            {state.creci ? (
              <div className="flex items-center gap-2 rounded-2xl border bg-muted/5 px-3 py-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <span>CRECI {state.creci}</span>
              </div>
            ) : null}
            {whatsappLabel ? (
              <div className="flex items-center gap-2 rounded-2xl border bg-muted/5 px-3 py-2">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                <span>WhatsApp {whatsappLabel}</span>
              </div>
            ) : null}
            <div className="flex items-center gap-2 rounded-2xl border bg-muted/5 px-3 py-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span>{state.responseTimeLabel?.trim() || "Tempo médio de resposta disponível quando configurado"}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-2xl border bg-muted/5 px-3 py-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>Atendimento pelo WhatsApp informado</span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border bg-muted/5 px-3 py-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span>Disponibilidade sob consulta</span>
            </div>
            {whatsappLabel ? (
              <div className="flex items-center gap-2 rounded-2xl border bg-muted/5 px-3 py-2">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                <span>WhatsApp {whatsappLabel}</span>
              </div>
            ) : null}
          </>
        )}
      </div>

      {state.note ? (
        <div className="mt-3 text-xs text-muted-foreground">
          {state.note}
        </div>
      ) : null}

      {whatsappHref ? (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className={`mt-4 inline-flex w-full items-center justify-center gap-2 border px-4 py-2 text-sm font-medium ${isPremium ? "rounded-full" : "rounded-2xl"}`}
        >
          <MessageCircle className="h-4 w-4" />
          {isBroker ? "Falar no WhatsApp" : "Chamar a equipe no WhatsApp"}
        </a>
      ) : null}
    </div>
  )
}
