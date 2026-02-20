import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { FollowupSettingsForm } from "@/components/followups/followup-settings-form"

type FollowupSettingsRow = {
  organization_id: string
  enabled: boolean
  step_5m_template: string
  step_24h_template: string
  step_3d_template: string
}

const DEFAULTS: Omit<FollowupSettingsRow, "organization_id"> = {
  enabled: true,
  step_5m_template: "Olá {{first_name}}, vi seu interesse e posso te ajudar agora. Posso te chamar no WhatsApp?",
  step_24h_template: "Oi {{first_name}}, passando para saber se você quer avançar com os imóveis que combinam com seu perfil.",
  step_3d_template: "Olá {{first_name}}, ainda tenho opções boas para você. Quer que eu te envie uma seleção atualizada?",
}

export default async function FollowupSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold md:text-2xl">Follow-up Automático</h1>
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
        <h1 className="text-lg font-semibold md:text-2xl">Follow-up Automático</h1>
        <p className="text-muted-foreground">Organização não encontrada para este usuário.</p>
      </div>
    )
  }

  const { data, error } = await supabase
    .from("followup_settings")
    .select("organization_id, enabled, step_5m_template, step_24h_template, step_3d_template")
    .eq("organization_id", organizationId)
    .maybeSingle()

  const tableReady = !error || error.code !== "42P01"
  const initial: FollowupSettingsRow = {
    organization_id: organizationId,
    enabled: data?.enabled ?? DEFAULTS.enabled,
    step_5m_template: data?.step_5m_template ?? DEFAULTS.step_5m_template,
    step_24h_template: data?.step_24h_template ?? DEFAULTS.step_24h_template,
    step_3d_template: data?.step_3d_template ?? DEFAULTS.step_3d_template,
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Follow-up Automático</h1>
          <p className="text-muted-foreground">
            Sequência padrão de contato para reduzir leads esquecidos: 5min, 24h e 3dias.
          </p>
        </div>
        <Link href="/settings">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>

      <div className="rounded-lg border bg-muted/10 p-4">
        <FollowupSettingsForm
          organizationId={organizationId}
          canManage={isAdmin}
          tableReady={tableReady}
          initial={initial}
        />
      </div>
    </div>
  )
}

