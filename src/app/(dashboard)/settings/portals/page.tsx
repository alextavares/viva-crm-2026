import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import PortalIntegrationsClient from "./client"

export default async function PortalsSettingsPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/signin")
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id, role")
        .eq("id", user.id)
        .single()

    const organizationId = profile?.organization_id
    const role = profile?.role

    if (!organizationId) {
        return <div>Usuário não está vinculado a nenhuma organização.</div>
    }

    // Only owner/manager can see/edit portal integrations
    if (role !== "owner" && role !== "manager") {
        return (
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-2xl font-semibold md:text-3xl">Integração de Portais</h1>
                    <p className="text-muted-foreground">Acesso negado. Apenas gestores podem gerenciar integrações.</p>
                </div>
            </div>
        )
    }

    // Fetch org string for the public URL builder
    const { data: org } = await supabase
        .from("organizations")
        .select("slug")
        .eq("id", organizationId)
        .single()

    // Fetch current integrations
    const { data: integrations } = await supabase
        .from("portal_integrations")
        .select("*")
        .eq("organization_id", organizationId)

    return (
        <div className="flex flex-col gap-6 max-w-5xl">
            <div>
                <h1 className="text-2xl font-semibold md:text-3xl">Integração de Portais XML</h1>
                <p className="text-muted-foreground mt-1">
                    Gere Feeds XML compatíveis com os maiores portais imobiliários para automatizar a publicação dos seus imóveis disponíveis.
                </p>
            </div>

            <PortalIntegrationsClient
                organizationId={organizationId}
                orgSlug={org?.slug || ''}
                initialIntegrations={integrations || []}
            />
        </div>
    )
}
