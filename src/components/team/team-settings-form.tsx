"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SeatCapacityAlert } from "@/components/team/seat-capacity-alert"
import { getSeatCapacityAlert } from "@/lib/team/billing"
import type { TeamAuditEvent, TeamInvite, TeamMember, TeamSeatUsage, UserRole } from "@/lib/types"

type TeamPayload = {
  ok: boolean
  usage: TeamSeatUsage
  members: TeamMember[]
  invites: TeamInvite[]
  audit_events: TeamAuditEvent[]
}

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "broker", label: "Corretor (consome assento)" },
  { value: "assistant", label: "Assistente" },
  { value: "manager", label: "Gerente" },
]

export function TeamSettingsForm({ canManage }: { canManage: boolean }) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<UserRole>("broker")
  const [loading, setLoading] = useState(true)
  const [submittingInvite, setSubmittingInvite] = useState(false)
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null)
  const [usage, setUsage] = useState<TeamSeatUsage | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<TeamInvite[]>([])
  const [auditEvents, setAuditEvents] = useState<TeamAuditEvent[]>([])

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        if (a.role === "owner") return -1
        if (b.role === "owner") return 1
        if (a.role === "manager" && b.role !== "owner") return -1
        if (b.role === "manager" && a.role !== "owner") return 1
        return (a.full_name || "").localeCompare(b.full_name || "", "pt-BR")
      }),
    [members]
  )
  const capacityAlert = useMemo(() => getSeatCapacityAlert(usage, 1), [usage])

  const loadTeam = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/settings/team", { cache: "no-store" })
      const data = (await response.json()) as TeamPayload | { message?: string }
      if (!response.ok || !("ok" in data) || !data.ok) {
        throw new Error(("message" in data && data.message) || "Falha ao carregar equipe.")
      }
      setUsage(data.usage)
      setMembers(data.members)
      setInvites(data.invites)
      setAuditEvents(data.audit_events || [])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao carregar equipe."
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTeam()
  }, [loadTeam])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!canManage) return

    setSubmittingInvite(true)
    try {
      const response = await fetch("/api/settings/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      })

      const data = (await response.json()) as { ok?: boolean; message?: string; code?: string }
      if (!response.ok || !data.ok) {
        if (data.code === "broker_seat_limit_reached") {
          throw new Error(data.message || "Limite de corretores atingido.")
        }
        throw new Error(data.message || "Falha ao enviar convite.")
      }

      toast.success("Convite enviado.")
      setEmail("")
      setRole("broker")
      await loadTeam()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao enviar convite."
      toast.error(message)
    } finally {
      setSubmittingInvite(false)
    }
  }

  async function handleStatusChange(profileId: string, isActive: boolean) {
    if (!canManage) return
    setUpdatingMemberId(profileId)
    try {
      const response = await fetch("/api/settings/team/member-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId, is_active: isActive }),
      })
      const data = (await response.json()) as { ok?: boolean; message?: string; code?: string }
      if (!response.ok || !data.ok) {
        if (data.code === "broker_seat_limit_reached") {
          throw new Error(data.message || "Limite de corretores atingido.")
        }
        throw new Error(data.message || "Falha ao atualizar status do corretor.")
      }

      toast.success(isActive ? "Corretor reativado." : "Corretor desativado.")
      await loadTeam()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao atualizar status."
      toast.error(message)
    } finally {
      setUpdatingMemberId(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border p-4">
        <h2 className="text-sm font-semibold">Capacidade do plano</h2>
        {usage ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Corretores ativos: <span className="font-medium text-foreground">{usage.used}</span> /{" "}
            <span className="font-medium text-foreground">{usage.seat_limit}</span> (disponíveis:{" "}
            <span className="font-medium text-foreground">{usage.available}</span>)
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Carregando capacidade...</p>
        )}
      </section>

      {capacityAlert ? <SeatCapacityAlert alert={capacityAlert} /> : null}

      <section className="rounded-md border p-4">
        <h2 className="text-sm font-semibold">Convidar para equipe</h2>
        <form className="mt-3 grid gap-3 md:grid-cols-3" onSubmit={handleInvite}>
          <div className="md:col-span-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="nome@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!canManage || submittingInvite}
              required
            />
          </div>
          <div>
            <Label>Perfil</Label>
            <Select value={role} onValueChange={(value) => setRole(value as UserRole)} disabled={!canManage || submittingInvite}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3">
            <Button disabled={!canManage || submittingInvite || !email.trim()}>
              {submittingInvite ? "Enviando..." : "Enviar convite"}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-md border p-4">
        <h2 className="text-sm font-semibold">Membros</h2>
        {loading ? (
          <p className="mt-3 text-sm text-muted-foreground">Carregando membros...</p>
        ) : sortedMembers.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhum membro encontrado.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {sortedMembers.map((member) => {
              const isBroker = member.role === "broker"
              return (
                <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">{member.full_name || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.role} {member.is_active ? "· ativo" : "· inativo"}{" "}
                      {member.consumes_seat ? "· consome assento" : ""}
                    </p>
                  </div>
                  {isBroker ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canManage || updatingMemberId === member.id}
                      onClick={() => handleStatusChange(member.id, !member.is_active)}
                    >
                      {updatingMemberId === member.id
                        ? "Salvando..."
                        : member.is_active
                          ? "Desativar"
                          : "Reativar"}
                    </Button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="rounded-md border p-4">
        <h2 className="text-sm font-semibold">Convites pendentes</h2>
        {loading ? (
          <p className="mt-3 text-sm text-muted-foreground">Carregando convites...</p>
        ) : invites.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhum convite pendente.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {invites.map((invite) => (
              <div key={invite.id} className="rounded-md border p-3">
                <p className="text-sm font-medium">{invite.email}</p>
                <p className="text-xs text-muted-foreground">
                  {invite.role} · pendente
                  {invite.expires_at ? ` · expira em ${new Date(invite.expires_at).toLocaleDateString("pt-BR")}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-md border p-4">
        <h2 className="text-sm font-semibold">Auditoria recente</h2>
        {loading ? (
          <p className="mt-3 text-sm text-muted-foreground">Carregando auditoria...</p>
        ) : auditEvents.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Sem eventos recentes.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {auditEvents.map((event) => (
              <div key={event.id} className="rounded-md border p-3">
                <p className="text-sm font-medium">{event.message || event.action}</p>
                <p className="text-xs text-muted-foreground">
                  {event.action} · {event.level} · {new Date(event.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
