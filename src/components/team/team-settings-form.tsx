"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import {
  inviteTeamMember,
  loadTeamSettingsData,
  updateBrokerPublicProfile,
  updateBrokerMemberStatus,
  type TeamSettingsData,
} from "@/app/actions/team"
import { SeatCapacityAlert } from "@/components/team/seat-capacity-alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getSeatCapacityAlert } from "@/lib/team/billing"
import type { UserRole } from "@/lib/types"

type InviteRole = Exclude<UserRole, "owner">

const ROLE_OPTIONS: Array<{ value: InviteRole; label: string }> = [
  { value: "broker", label: "Corretor (consome assento)" },
  { value: "assistant", label: "Assistente" },
  { value: "manager", label: "Gerente" },
]

export function TeamSettingsForm({ canManage }: { canManage: boolean }) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<InviteRole>("broker")
  const [loading, setLoading] = useState(true)
  const [submittingInvite, setSubmittingInvite] = useState(false)
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null)
  const [savingPublicProfileId, setSavingPublicProfileId] = useState<string | null>(null)
  const [data, setData] = useState<TeamSettingsData | null>(null)
  const [publicProfiles, setPublicProfiles] = useState<Record<string, {
    public_display_name: string
    creci: string
    public_whatsapp: string
    avatar_url: string
    public_profile_enabled: boolean
  }>>({})
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const sortedMembers = useMemo(
    () =>
      [...(data?.members || [])].sort((a, b) => {
        if (a.role === "owner") return -1
        if (b.role === "owner") return 1
        if (a.role === "manager" && b.role !== "owner") return -1
        if (b.role === "manager" && a.role !== "owner") return 1
        return (a.full_name || "").localeCompare(b.full_name || "", "pt-BR")
      }),
    [data?.members]
  )

  const capacityAlert = useMemo(() => getSeatCapacityAlert(data?.usage || null, 1), [data?.usage])

  const loadTeam = useCallback(async () => {
    if (!canManage) return

    setLoading(true)
    const result = await loadTeamSettingsData()
    if (result.success) {
      setData(result.data)
      setPublicProfiles(
        Object.fromEntries(
          (result.data?.members || []).map((member) => [
            member.id,
            {
              public_display_name: member.public_display_name ?? "",
              creci: member.creci ?? "",
              public_whatsapp: member.public_whatsapp ?? "",
              avatar_url: member.avatar_url ?? "",
              public_profile_enabled: Boolean(member.public_profile_enabled),
            },
          ])
        )
      )
      setErrorMsg(null)
    } else {
      const message = result.error || "Falha ao carregar equipe."
      setErrorMsg(message)
      toast.error(message)
    }
    setLoading(false)
  }, [canManage])

  useEffect(() => {
    if (!canManage) return

    const timeoutId = window.setTimeout(() => {
      void loadTeam()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [canManage, loadTeam])

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManage) return

    setSubmittingInvite(true)
    setErrorMsg(null)
    const result = await inviteTeamMember({ email, role })

    if (result.success) {
      toast.success("Convite enviado.")
      setEmail("")
      setRole("broker")
      await loadTeam()
    } else {
      const message = result.error || "Falha ao enviar convite."
      setErrorMsg(message)
      toast.error(message)
    }
    setSubmittingInvite(false)
  }

  async function handleStatusChange(profileId: string, isActive: boolean) {
    if (!canManage) return

    setUpdatingMemberId(profileId)
    setErrorMsg(null)
    const result = await updateBrokerMemberStatus({ profileId, isActive })

    if (result.success) {
      toast.success(isActive ? "Corretor reativado." : "Corretor desativado.")
      await loadTeam()
    } else {
      const message = result.error || "Falha ao atualizar status do corretor."
      setErrorMsg(message)
      toast.error(message)
    }
    setUpdatingMemberId(null)
  }

  function updatePublicProfileDraft(
    profileId: string,
    field: "public_display_name" | "creci" | "public_whatsapp" | "avatar_url" | "public_profile_enabled",
    value: string | boolean
  ) {
    setPublicProfiles((current) => {
      const currentDraft = current[profileId] ?? {
        public_display_name: "",
        creci: "",
        public_whatsapp: "",
        avatar_url: "",
        public_profile_enabled: false,
      }

      return {
        ...current,
        [profileId]: {
          ...currentDraft,
          [field]: value,
        },
      }
    })
  }

  async function handlePublicProfileSave(profileId: string) {
    if (!canManage) return

    const draft = publicProfiles[profileId]
    if (!draft) return

    setSavingPublicProfileId(profileId)
    setErrorMsg(null)
    const result = await updateBrokerPublicProfile({
      profileId,
      public_display_name: draft.public_display_name,
      creci: draft.creci,
      public_whatsapp: draft.public_whatsapp,
      avatar_url: draft.avatar_url,
      public_profile_enabled: draft.public_profile_enabled,
    })

    if (result.success) {
      toast.success("Perfil público salvo.")
      await loadTeam()
    } else {
      const message = result.error || "Falha ao salvar perfil público."
      setErrorMsg(message)
      toast.error(message)
    }

    setSavingPublicProfileId(null)
  }

  return (
    <div className="space-y-6">
      {errorMsg ? <p className="text-sm text-red-600">{errorMsg}</p> : null}

      <section className="rounded-md border p-4">
        <h2 className="text-sm font-semibold">Capacidade do plano</h2>
        {data?.usage ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Corretores ativos: <span className="font-medium text-foreground">{data.usage.used}</span> /{" "}
            <span className="font-medium text-foreground">{data.usage.seat_limit}</span> (disponíveis:{" "}
            <span className="font-medium text-foreground">{data.usage.available}</span>)
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
              onChange={(event) => setEmail(event.target.value)}
              disabled={!canManage || submittingInvite}
              required
            />
          </div>
          <div>
            <Label htmlFor="invite-role">Perfil</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as InviteRole)}
              disabled={!canManage || submittingInvite}
            >
              <SelectTrigger id="invite-role">
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
                <div key={member.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
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

                  {isBroker ? (
                    <div className="mt-4 rounded-md border bg-muted/10 p-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Perfil público do corretor
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Quando desativado, o detalhe público continua usando “Equipe da imobiliária”.
                      </p>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <Label htmlFor={`public-name-${member.id}`}>Nome público</Label>
                          <Input
                            id={`public-name-${member.id}`}
                            value={publicProfiles[member.id]?.public_display_name ?? ""}
                            onChange={(event) =>
                              updatePublicProfileDraft(member.id, "public_display_name", event.target.value)
                            }
                            placeholder={member.full_name || "Nome do corretor"}
                            disabled={!canManage || savingPublicProfileId === member.id}
                          />
                        </div>

                        <div>
                          <Label htmlFor={`public-creci-${member.id}`}>CRECI</Label>
                          <Input
                            id={`public-creci-${member.id}`}
                            value={publicProfiles[member.id]?.creci ?? ""}
                            onChange={(event) =>
                              updatePublicProfileDraft(member.id, "creci", event.target.value)
                            }
                            placeholder="Ex.: 123456-F"
                            disabled={!canManage || savingPublicProfileId === member.id}
                          />
                        </div>

                        <div>
                          <Label htmlFor={`public-whatsapp-${member.id}`}>WhatsApp público</Label>
                          <Input
                            id={`public-whatsapp-${member.id}`}
                            value={publicProfiles[member.id]?.public_whatsapp ?? ""}
                            onChange={(event) =>
                              updatePublicProfileDraft(member.id, "public_whatsapp", event.target.value)
                            }
                            placeholder="Ex.: (11) 99999-9999"
                            disabled={!canManage || savingPublicProfileId === member.id}
                          />
                        </div>

                        <div>
                          <Label htmlFor={`public-avatar-${member.id}`}>Avatar público (URL)</Label>
                          <Input
                            id={`public-avatar-${member.id}`}
                            type="url"
                            value={publicProfiles[member.id]?.avatar_url ?? ""}
                            onChange={(event) =>
                              updatePublicProfileDraft(member.id, "avatar_url", event.target.value)
                            }
                            placeholder="https://..."
                            disabled={!canManage || savingPublicProfileId === member.id}
                          />
                        </div>
                      </div>

                      <label className="mt-3 flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(publicProfiles[member.id]?.public_profile_enabled)}
                          onChange={(event) =>
                            updatePublicProfileDraft(member.id, "public_profile_enabled", event.target.checked)
                          }
                          disabled={!canManage || savingPublicProfileId === member.id}
                        />
                        Exibir corretor no site público
                      </label>

                      <div className="mt-3 flex justify-end">
                        <Button
                          size="sm"
                          disabled={!canManage || savingPublicProfileId === member.id}
                          onClick={() => handlePublicProfileSave(member.id)}
                        >
                          {savingPublicProfileId === member.id ? "Salvando..." : "Salvar perfil público"}
                        </Button>
                      </div>
                    </div>
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
        ) : !data?.invites || data.invites.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhum convite pendente.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {data.invites.map((invite) => (
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
        ) : !data?.audit_events || data.audit_events.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Sem eventos recentes.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {data.audit_events.map((event) => (
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
