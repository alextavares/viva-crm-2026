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

    const { data: contracts, error: contractsError } = await supabase
        .from("deal_contracts")
        .select(`
            id,
            assigned_to,
            contract_type,
            final_value,
            commission_value,
            status,
            start_date,
            end_date,
            created_at,
            proposal_id,
            properties:properties!deal_contracts_property_id_fkey ( title, public_code ),
            contacts:contacts!deal_contracts_contact_id_fkey ( name, email, phone )
        `)
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false })

    if (contractsError) {
        console.error("Error fetching contracts:", {
            message: contractsError.message,
            details: contractsError.details,
            hint: contractsError.hint,
            code: contractsError.code,
        })
        throw new Error(`Não foi possível carregar contratos: ${contractsError.message ?? "erro desconhecido"}`)
    }

    const assignedProfileIds = Array.from(
        new Set((contracts || []).map((contract) => contract.assigned_to).filter(Boolean))
    ) as string[]

    let profileMap = new Map<string, { full_name: string | null }>()

    if (assignedProfileIds.length > 0) {
        const { data: assignedProfiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", assignedProfileIds)

        if (profilesError) {
            console.error("Error fetching contract assignees:", {
                message: profilesError.message,
                details: profilesError.details,
                hint: profilesError.hint,
                code: profilesError.code,
            })
        } else {
            profileMap = new Map(
                (assignedProfiles || []).map((profileRow) => [
                    profileRow.id,
                    { full_name: profileRow.full_name ?? null },
                ])
            )
        }
    }

    const contractsWithProfiles = (contracts || []).map((contract) => ({
        ...contract,
        profiles: contract.assigned_to ? profileMap.get(contract.assigned_to) ?? null : null,
    }))

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Fechamentos e contratos</h2>
                    <p className="text-muted-foreground">
                        Registre negócios fechados, valores e documentos do fluxo comercial.
                    </p>
                </div>
            </div>

            <ContractsClient
                initialData={contractsWithProfiles}
                organizationId={profile.organization_id}
                role={profile.role}
            />
        </div>
    )
}
