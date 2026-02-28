import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { TeamSettingsForm } from "@/components/team/team-settings-form"

export default async function TeamSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold md:text-2xl">Equipe</h1>
        <p className="text-muted-foreground">Faça login para continuar.</p>
      </div>
    )
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  const role = (profile?.role as string | null) ?? null
  const canManage = role === "owner" || role === "manager"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Equipe</h1>
          <p className="text-muted-foreground">Gerencie corretores, convites e capacidade de assentos do plano.</p>
        </div>
        <Link href="/settings">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>

      {!canManage ? (
        <div className="rounded-md border p-4 text-sm text-muted-foreground">
          Apenas <span className="font-medium text-foreground">owner/manager</span> podem gerenciar equipe.
        </div>
      ) : (
        <div className="rounded-lg border bg-muted/10 p-4">
          <TeamSettingsForm canManage={canManage} />
        </div>
      )}
    </div>
  )
}

