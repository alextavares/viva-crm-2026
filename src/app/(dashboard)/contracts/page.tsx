import { createClient } from "@/lib/supabase/server"
import { ContractsClient } from "@/components/contracts/contracts-client"
import { redirect } from "next/navigation"

export default async function ContractsPage() {
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
        redirect("/login")
    }

    const { data: contracts } = await supabase
        .from("deal_contracts")
        .select(`
            id,
            contract_type,
            final_value,
            commission_value,
            status,
            start_date,
            end_date,
            created_at,
            proposal_id,
            properties ( title, public_code ),
            contacts ( name, email, phone ),
            profiles ( full_name )
        `)
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false })

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Contratos</h2>
                    <p className="text-muted-foreground">
                        Gestão de contratos e comissionamentos da sua imobiliária.
                    </p>
                </div>
            </div>

            <ContractsClient initialData={contracts || []} organizationId={profile.organization_id} role={profile.role} />
        </div>
    )
}
