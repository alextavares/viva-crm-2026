import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { GoalBrokerReport, type GoalBrokerReportRow } from "@/components/goals/goal-broker-report"
import { GoalsSettingsForm, type BrokerOverrideDraft } from "@/components/goals/goals-settings-form"

type GoalSettingsRow = {
  organization_id: string
  enabled: boolean
  period_type: "weekly" | "monthly"
  metric_captacoes_enabled: boolean
  metric_respostas_enabled: boolean
  metric_visitas_enabled: boolean
  response_sla_minutes: number
  target_captacoes: number
  target_respostas: number
  target_visitas: number
}

type BrokerProfile = {
  id: string
  name: string | null
  email: string | null
}

type GoalOverrideRow = {
  profile_id: string
  enabled: boolean
  period_type: "weekly" | "monthly" | null
  metric_captacoes_enabled: boolean | null
  metric_respostas_enabled: boolean | null
  metric_visitas_enabled: boolean | null
  response_sla_minutes: number | null
  target_captacoes: number | null
  target_respostas: number | null
  target_visitas: number | null
}

type GoalSnapshotResult = {
  ok?: boolean
  current_captacoes?: number
  current_respostas?: number
  current_visitas?: number
  progress_captacoes_pct?: number
  progress_respostas_pct?: number
  progress_visitas_pct?: number
}

const DEFAULTS: Omit<GoalSettingsRow, "organization_id"> = {
  enabled: true,
  period_type: "weekly",
  metric_captacoes_enabled: true,
  metric_respostas_enabled: true,
  metric_visitas_enabled: true,
  response_sla_minutes: 15,
  target_captacoes: 4,
  target_respostas: 20,
  target_visitas: 6,
}

function pickOrigin<T>(value: T | null) {
  return value === null ? "global" : "override"
}

function toInt(value: unknown, fallback = 0) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.trunc(parsed))
}

function formatGoalProgress(enabled: boolean, current: unknown, target: number, pct: unknown) {
  if (!enabled) return "Desativada"
  const safeCurrent = toInt(current, 0)
  const safeTarget = Math.max(0, Math.trunc(target))
  const safePct = Math.min(100, toInt(pct, 0))
  return `${safeCurrent} / ${safeTarget} (${safePct}%)`
}

export default async function GoalsSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold md:text-2xl">Metas do Corretor</h1>
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
        <h1 className="text-lg font-semibold md:text-2xl">Metas do Corretor</h1>
        <p className="text-muted-foreground">Organização não encontrada para este usuário.</p>
      </div>
    )
  }

  const [settingsResult, brokersResult, overridesResult] = await Promise.all([
    supabase
      .from("goal_settings")
      .select("organization_id, enabled, period_type, metric_captacoes_enabled, metric_respostas_enabled, metric_visitas_enabled, response_sla_minutes, target_captacoes, target_respostas, target_visitas")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("id, name, email")
      .eq("organization_id", organizationId)
      .eq("role", "broker")
      .order("created_at", { ascending: true }),
    supabase
      .from("goal_broker_overrides")
      .select("profile_id, enabled, period_type, metric_captacoes_enabled, metric_respostas_enabled, metric_visitas_enabled, response_sla_minutes, target_captacoes, target_respostas, target_visitas")
      .eq("organization_id", organizationId),
  ])

  const settingsError = settingsResult.error
  const overridesError = overridesResult.error
  const tableReady =
    (!settingsError || (settingsError.code !== "42P01" && settingsError.code !== "42703")) &&
    (!overridesError || (overridesError.code !== "42P01" && overridesError.code !== "42703"))

  const settingsData = settingsResult.data as GoalSettingsRow | null
  const initial: GoalSettingsRow = {
    organization_id: organizationId,
    enabled: settingsData?.enabled ?? DEFAULTS.enabled,
    period_type: (settingsData?.period_type as "weekly" | "monthly" | undefined) ?? DEFAULTS.period_type,
    metric_captacoes_enabled: settingsData?.metric_captacoes_enabled ?? DEFAULTS.metric_captacoes_enabled,
    metric_respostas_enabled: settingsData?.metric_respostas_enabled ?? DEFAULTS.metric_respostas_enabled,
    metric_visitas_enabled: settingsData?.metric_visitas_enabled ?? DEFAULTS.metric_visitas_enabled,
    response_sla_minutes: settingsData?.response_sla_minutes ?? DEFAULTS.response_sla_minutes,
    target_captacoes: settingsData?.target_captacoes ?? DEFAULTS.target_captacoes,
    target_respostas: settingsData?.target_respostas ?? DEFAULTS.target_respostas,
    target_visitas: settingsData?.target_visitas ?? DEFAULTS.target_visitas,
  }

  const brokers = ((brokersResult.data as BrokerProfile[] | null) || []).map((b) => ({
    id: b.id,
    name: b.name,
    email: b.email,
  }))

  const overrideMap = new Map<string, GoalOverrideRow>()
  for (const row of ((overridesResult.data as GoalOverrideRow[] | null) || [])) {
    overrideMap.set(row.profile_id, row)
  }

  const initialOverrides: BrokerOverrideDraft[] = brokers.map((broker) => {
    const row = overrideMap.get(broker.id)
    return {
      profile_id: broker.id,
      name: broker.name,
      email: broker.email,
      enabled: row?.enabled ?? true,
      period_type: row?.period_type ?? null,
      metric_captacoes_enabled: row?.metric_captacoes_enabled ?? null,
      metric_respostas_enabled: row?.metric_respostas_enabled ?? null,
      metric_visitas_enabled: row?.metric_visitas_enabled ?? null,
      response_sla_minutes: row?.response_sla_minutes ?? null,
      target_captacoes: row?.target_captacoes ?? null,
      target_respostas: row?.target_respostas ?? null,
      target_visitas: row?.target_visitas ?? null,
    }
  })

  const snapshotMap = new Map<string, GoalSnapshotResult | null>()
  if (tableReady && isAdmin && brokers.length > 0) {
    const snapshotEntries = await Promise.all(
      brokers.map(async (broker) => {
        const { data, error } = await supabase.rpc("goals_dashboard_snapshot", {
          p_org_id: organizationId,
          p_profile_id: broker.id,
        })

        if (error) {
          return [broker.id, null] as const
        }

        const snapshot = (data as GoalSnapshotResult | null) ?? null
        return [broker.id, snapshot?.ok ? snapshot : null] as const
      })
    )

    for (const [profileId, snapshot] of snapshotEntries) {
      snapshotMap.set(profileId, snapshot)
    }
  }

  const reportRows: GoalBrokerReportRow[] = initialOverrides.map((override) => {
    const captacoesEnabled = override.metric_captacoes_enabled ?? initial.metric_captacoes_enabled
    const respostasEnabled = override.metric_respostas_enabled ?? initial.metric_respostas_enabled
    const visitasEnabled = override.metric_visitas_enabled ?? initial.metric_visitas_enabled

    const periodType = override.period_type ?? initial.period_type
    const targetCaptacoes = override.target_captacoes ?? initial.target_captacoes
    const targetRespostas = override.target_respostas ?? initial.target_respostas
    const targetVisitas = override.target_visitas ?? initial.target_visitas
    const responseSlaMinutes = override.response_sla_minutes ?? initial.response_sla_minutes
    const snapshot = snapshotMap.get(override.profile_id)

    return {
      profile_id: override.profile_id,
      name: override.name,
      email: override.email,
      enabled: initial.enabled && override.enabled,
      period_type: periodType,
      period_origin: pickOrigin(override.period_type),
      captacoes_enabled: captacoesEnabled,
      captacoes_pct: toInt(snapshot?.progress_captacoes_pct, 0),
      captacoes_label: formatGoalProgress(
        captacoesEnabled,
        snapshot?.current_captacoes,
        targetCaptacoes,
        snapshot?.progress_captacoes_pct
      ),
      captacoes_origin: captacoesEnabled
        ? pickOrigin(override.target_captacoes)
        : pickOrigin(override.metric_captacoes_enabled),
      respostas_enabled: respostasEnabled,
      respostas_pct: toInt(snapshot?.progress_respostas_pct, 0),
      respostas_label: formatGoalProgress(
        respostasEnabled,
        snapshot?.current_respostas,
        targetRespostas,
        snapshot?.progress_respostas_pct
      ),
      respostas_origin: respostasEnabled
        ? pickOrigin(override.target_respostas)
        : pickOrigin(override.metric_respostas_enabled),
      visitas_enabled: visitasEnabled,
      visitas_pct: toInt(snapshot?.progress_visitas_pct, 0),
      visitas_label: formatGoalProgress(
        visitasEnabled,
        snapshot?.current_visitas,
        targetVisitas,
        snapshot?.progress_visitas_pct
      ),
      visitas_origin: visitasEnabled
        ? pickOrigin(override.target_visitas)
        : pickOrigin(override.metric_visitas_enabled),
      sla_label: respostasEnabled ? `${responseSlaMinutes} min` : "N/A",
      sla_origin: respostasEnabled
        ? pickOrigin(override.response_sla_minutes)
        : pickOrigin(override.metric_respostas_enabled),
    }
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Metas do Corretor</h1>
          <p className="text-muted-foreground">
            Configure metas semanais/mensais de captação, resposta rápida e visitas. Owner/manager decide o padrão e pode ajustar por corretor.
          </p>
        </div>
        <Link href="/settings">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>

      <div className="rounded-lg border bg-muted/10 p-4">
        <GoalsSettingsForm
          organizationId={organizationId}
          canManage={isAdmin}
          tableReady={tableReady}
          initial={initial}
          initialOverrides={initialOverrides}
        />
      </div>

      {tableReady && isAdmin ? <GoalBrokerReport rows={reportRows} /> : null}
    </div>
  )
}
