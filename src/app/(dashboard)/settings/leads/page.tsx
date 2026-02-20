import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { LeadDistributionSettingsForm } from "@/components/leads/lead-distribution-settings-form"

type LeadDistributionSettingsRow = {
  organization_id: string
  enabled: boolean
  mode: "round_robin"
  sla_minutes: number
  redistribute_overdue: boolean
}

const DEFAULTS: Omit<LeadDistributionSettingsRow, "organization_id"> = {
  enabled: true,
  mode: "round_robin",
  sla_minutes: 15,
  redistribute_overdue: true,
}

export default async function LeadDistributionSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold md:text-2xl">Distribuição de Leads + SLA</h1>
        <p className="text-muted-foreground">Faça login para continuar.</p>
      </div>
    )
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  const organizationId = profile?.organization_id ?? null
  const role = (profile?.role as string | null) ?? null
  const isAdmin = role === "owner" || role === "manager"

  if (!organizationId) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold md:text-2xl">Distribuição de Leads + SLA</h1>
        <p className="text-muted-foreground">Organização não encontrada para este usuário.</p>
      </div>
    )
  }

  const { data, error } = await supabase
    .from("lead_distribution_settings")
    .select("organization_id, enabled, mode, sla_minutes, redistribute_overdue")
    .eq("organization_id", organizationId)
    .maybeSingle()

  const tableReady = !error || error.code !== "42P01"
  const initial: LeadDistributionSettingsRow = {
    organization_id: organizationId,
    enabled: data?.enabled ?? DEFAULTS.enabled,
    mode: (data?.mode as "round_robin" | undefined) ?? DEFAULTS.mode,
    sla_minutes: data?.sla_minutes ?? DEFAULTS.sla_minutes,
    redistribute_overdue: data?.redistribute_overdue ?? DEFAULTS.redistribute_overdue,
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Distribuição de Leads + SLA</h1>
          <p className="text-muted-foreground">
            Distribua novos leads automaticamente para brokers e monitore o tempo de primeira resposta.
          </p>
        </div>
        <Link href="/settings">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>

      <div className="rounded-lg border bg-muted/10 p-4">
        <LeadDistributionSettingsForm
          organizationId={organizationId}
          canManage={isAdmin}
          tableReady={tableReady}
          initial={initial}
        />
      </div>
    </div>
  )
}
