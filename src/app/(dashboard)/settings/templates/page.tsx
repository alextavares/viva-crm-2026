import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { TemplatesClient } from "@/components/settings/templates/templates-client"

export const metadata = {
    title: "Templates de Mensagem | Imobi CRM",
}

export default async function TemplatesPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id, role")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) {
        return (
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold">Templates</h1>
                <p className="text-muted-foreground">Você precisa estar em uma organização.</p>
            </div>
        )
    }

    const isAdmin = profile.role === "owner" || profile.role === "manager"

    const { data: templates } = await supabase
        .from("message_templates")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false })

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-semibold md:text-3xl">Templates de Mensagem</h1>
                <p className="text-muted-foreground">
                    Crie modelos de E-mail e WhatsApp para responder mais rápido.
                </p>
            </div>

            <TemplatesClient
                initialTemplates={templates || []}
                isAdmin={isAdmin}
                organizationId={profile.organization_id}
            />
        </div>
    )
}
