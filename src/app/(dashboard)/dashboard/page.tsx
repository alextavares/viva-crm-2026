import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building, Users, Calendar, DollarSign } from "lucide-react"
import { DashboardCharts } from "@/components/dashboard/dashboard-charts"
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist"

export default async function DashboardPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const { data: profile } = user
        ? await supabase
              .from("profiles")
              .select("organization_id, role")
              .eq("id", user.id)
              .single()
        : { data: null }

    const orgId = profile?.organization_id ?? null
    const role = (profile?.role as string | null) ?? null
    const isAdmin = role === "owner" || role === "manager"

    const { data: org } = orgId
        ? await supabase.from("organizations").select("slug").eq("id", orgId).single()
        : { data: null }

    const siteSlug = (org?.slug as string | null) ?? null

    // Fetch stats in parallel
    const [propertiesResult, contactsResult, appointmentsResult, propertiesAll, contactsAll, siteSettings, publishedCount] = await Promise.all([
        supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'available'),
        supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('type', 'lead'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).gte('date', new Date().toISOString()),
        supabase.from('properties').select('status'),
        supabase.from('contacts').select('type'),
        orgId
            ? supabase
                  .from("site_settings")
                  .select("brand_name, whatsapp, email")
                  .eq("organization_id", orgId)
                  .maybeSingle()
            : Promise.resolve({ data: null }),
        supabase
            .from("properties")
            .select("id", { count: "exact", head: true })
            .eq("status", "available")
            .eq("hide_from_site", false),
    ])

    const activeProperties = propertiesResult.count || 0
    const activeLeads = contactsResult.count || 0
    const upcomingAppointments = appointmentsResult.count || 0

    const hasProperty = (propertiesAll.data?.length ?? 0) > 0
    const hasPublishedProperty = (publishedCount.count ?? 0) > 0
    const hasLead = activeLeads > 0
    const hasSiteConfigured = Boolean(
        siteSettings?.data?.brand_name?.trim() &&
            siteSettings?.data?.whatsapp?.trim() &&
            siteSettings?.data?.email?.trim()
    )

    // Aggregate data for charts
    const propertyStatusCounts = (propertiesAll.data || []).reduce((acc, curr) => {
        const status = curr.status || 'unknown'
        acc[status] = (acc[status] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    const propertiesByStatus = Object.entries(propertyStatusCounts).map(([name, value]) => ({
        name: name === 'available' ? 'Disponível' : name === 'sold' ? 'Vendido' : name === 'rented' ? 'Alugado' : name,
        value
    }))

    const contactTypeCounts = (contactsAll.data || []).reduce((acc, curr) => {
        const type = curr.type || 'unknown'
        acc[type] = (acc[type] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    const leadsByType = Object.entries(contactTypeCounts).map(([name, value]) => ({
        name: name === 'lead' ? 'Lead' : name === 'client' ? 'Cliente' : name === 'owner' ? 'Proprietário' : name === 'partner' ? 'Parceiro' : name,
        value
    }))

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">Visão geral do seu negócio.</p>
            </div>

            <OnboardingChecklist
                siteSlug={siteSlug}
                isAdmin={isAdmin}
                hasSiteConfigured={hasSiteConfigured}
                hasProperty={hasProperty}
                hasPublishedProperty={hasPublishedProperty}
                hasLead={hasLead}
            />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Imóveis Disponíveis</CardTitle>
                        <Building className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeProperties}</div>
                        <p className="text-xs text-muted-foreground">
                            Ativos na carteira
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Leads Ativos</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeLeads}</div>
                        <p className="text-xs text-muted-foreground">
                            Potenciais clientes
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Visitas Agendadas</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{upcomingAppointments}</div>
                        <p className="text-xs text-muted-foreground">
                            Próximos compromissos
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Vendas (Mês)</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">R$ 0,00</div>
                        <p className="text-xs text-muted-foreground">
                            Placeholder (Em Breve)
                        </p>
                    </CardContent>
                </Card>
            </div>
            <DashboardCharts propertiesByStatus={propertiesByStatus} leadsByType={leadsByType} />
        </div>
    )
}
