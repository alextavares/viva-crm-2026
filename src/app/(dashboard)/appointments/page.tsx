import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, Calendar, MapPin, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AppointmentsCalendar } from '@/components/appointments/appointments-calendar'
import { AppointmentsFiltersInstant } from '@/components/appointments/appointments-filters-instant'
import { AppointmentsTabs, type AppointmentsTabValue } from '@/components/appointments/appointments-tabs'
import { LayoutGrid, Calendar as CalendarIcon } from 'lucide-react'

export default async function AppointmentsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }> // Updated type
}) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    const { data: profile } = user
        ? await supabase
              .from("profiles")
              .select("role")
              .eq("id", user.id)
              .single()
        : { data: null }
    const resolvedSearchParams = await searchParams
    const view = resolvedSearchParams?.view as string || 'list'
    const q = typeof resolvedSearchParams?.q === 'string' ? resolvedSearchParams.q.trim() : ''
    const statusFilter = typeof resolvedSearchParams?.status === 'string' ? resolvedSearchParams.status : 'all'
    const rawTab = typeof resolvedSearchParams?.tab === 'string' ? resolvedSearchParams.tab : 'scheduled'
    const tab: AppointmentsTabValue =
        rawTab === 'scheduled' || rawTab === 'history' || rawTab === 'all' ? rawTab : 'scheduled'
    const nowIso = new Date().toISOString()
    const isBroker = profile?.role === "broker"

    const scheduledCountQuery = supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'scheduled')
        .gte('starts_at', nowIso)
    const historyCountQuery = supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .or(`status.in.(completed,cancelled,no_show),starts_at.lt.${nowIso}`)
    const allCountQuery = supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })

    const [scheduledCountResult, historyCountResult, allCountResult] = await Promise.all([
        isBroker && user?.id ? scheduledCountQuery.eq('assigned_to', user.id) : scheduledCountQuery,
        isBroker && user?.id ? historyCountQuery.eq('assigned_to', user.id) : historyCountQuery,
        isBroker && user?.id ? allCountQuery.eq('assigned_to', user.id) : allCountQuery,
    ])

    let query = supabase
        .from('appointments')
        .select(`
            *,
            properties (title, address),
            contacts (name, phone, email),
            profiles (full_name)
        `)
        .order('starts_at', { ascending: true })

    if (isBroker && user?.id) {
        query = query.eq('assigned_to', user.id)
    }

    if (statusFilter === 'all') {
        if (tab === 'scheduled') {
            query = query.eq('status', 'scheduled').gte('starts_at', nowIso)
        }

        if (tab === 'history') {
            query = query.or(`status.in.(completed,cancelled,no_show),date.lt.${nowIso}`)
        }
    } else {
        query = query.eq('status', statusFilter)
    }

    const { data: appointments, error } = await query

    if (error) {
        console.error('Error fetching appointments:', error)
    }

    const qLower = q.toLowerCase()
    const filteredAppointments = (appointments || []).filter((appointment) => {
        if (!qLower) return true
        const haystack = [
            appointment.contacts?.name,
            appointment.contacts?.phone,
            appointment.contacts?.email,
            appointment.properties?.title,
            appointment.properties?.address?.full_address,
            appointment.notes,
        ]
            .filter((v): v is string => typeof v === 'string' && v.length > 0)
            .join(' ')
            .toLowerCase()

        return haystack.includes(qLower)
    })
    const now = new Date()
    const endOfToday = new Date(now)
    endOfToday.setHours(23, 59, 59, 999)
    const next48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)

    const visitsTodayCount = filteredAppointments.filter((appointment) => {
        const date = new Date(appointment.starts_at)
        return appointment.status === 'scheduled' && date >= now && date <= endOfToday
    }).length

    const visits48hCount = filteredAppointments.filter((appointment) => {
        const date = new Date(appointment.starts_at)
        return appointment.status === 'scheduled' && date > endOfToday && date <= next48h
    }).length

    const buildAppointmentsHref = (nextView: 'list' | 'calendar') => {
        const params = new URLSearchParams()
        if (nextView !== 'list') params.set('view', nextView)
        if (q) params.set('q', q)
        if (statusFilter !== 'all') params.set('status', statusFilter)
        if (tab !== 'scheduled') params.set('tab', tab)
        const qs = params.toString()
        return qs ? `/appointments?${qs}` : '/appointments'
    }

    const buildTabHref = (nextTab: AppointmentsTabValue) => {
        const params = new URLSearchParams()
        if (view !== 'list') params.set('view', view)
        if (q) params.set('q', q)
        if (statusFilter !== 'all') params.set('status', statusFilter)
        if (nextTab !== 'scheduled') params.set('tab', nextTab)
        const qs = params.toString()
        return qs ? `/appointments?${qs}` : '/appointments'
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'scheduled': return 'Agendado'
            case 'completed': return 'Realizado'
            case 'cancelled': return 'Cancelado'
            case 'no_show': return 'Não Compareceu'
            default: return status
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'scheduled': return 'default'
            case 'completed': return 'secondary' // or success green if available
            case 'cancelled': return 'destructive'
            case 'no_show': return 'outline'
            default: return 'outline'
        }
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold md:text-2xl">Agendamentos</h1>
                    <p className="text-muted-foreground">Gerencie suas visitas e compromissos.</p>
                </div>
                <Link href="/appointments/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Nova Visita
                    </Button>
                </Link>
            </div>

            <div className="flex items-center justify-end">
                <div className="flex bg-muted rounded-lg p-1">
                    <Link href={buildAppointmentsHref('list')}>
                        <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-2">
                            <LayoutGrid className="h-4 w-4" />
                            Lista
                        </Button>
                    </Link>
                    <Link href={buildAppointmentsHref('calendar')}>
                        <Button variant={view === 'calendar' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-2">
                            <CalendarIcon className="h-4 w-4" />
                            Calendário
                        </Button>
                    </Link>
                </div>
            </div>

            <AppointmentsTabs
                activeTab={tab}
                counts={{
                    scheduled: scheduledCountResult.count || 0,
                    history: historyCountResult.count || 0,
                    all: allCountResult.count || 0,
                }}
                buildHref={buildTabHref}
            />

            <AppointmentsFiltersInstant
                key={`${view}|${q}|${statusFilter}|${tab}`}
                baseRoute="/appointments"
                view={view}
                initialValues={{
                    q,
                    status: statusFilter,
                }}
            />

            <div className="grid gap-3 sm:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Visitas de hoje</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="text-2xl font-semibold">{visitsTodayCount}</div>
                        <p className="text-xs text-muted-foreground">Compromissos que pedem confirmação ou execução hoje.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Próximas 48h</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="text-2xl font-semibold">{visits48hCount}</div>
                        <p className="text-xs text-muted-foreground">Visitas que já pedem preparação nas próximas 48 horas.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{isBroker ? "Minha agenda" : "Agenda ativa"}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="text-2xl font-semibold">{filteredAppointments.length}</div>
                        <p className="text-xs text-muted-foreground">
                            {isBroker ? "Visão operacional do corretor neste recorte." : "Compromissos dentro do recorte atual."}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {view === 'calendar' ? (
                <AppointmentsCalendar appointments={filteredAppointments} />
            ) : (
                (!filteredAppointments || filteredAppointments.length === 0) ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center border rounded-lg bg-muted/20 border-dashed">
                        <Calendar className="h-10 w-10 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold">Nenhum agendamento encontrado</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mb-4">
                            Agende visitas para seus imóveis e contatos.
                        </p>
                        <Link href="/appointments/new">
                            <Button variant="outline">Agendar Primeira Visita</Button>
                        </Link>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredAppointments.map((appointment) => (
                            <Card key={appointment.id} className="hover:shadow-md transition-shadow">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">
                                        {formatDate(appointment.starts_at)}
                                    </CardTitle>
                                    <Badge variant={getStatusColor(appointment.status) as "default" | "secondary" | "destructive" | "outline"}>
                                        {getStatusLabel(appointment.status)}
                                    </Badge>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid gap-2 text-sm mt-3">
                                        {appointment.properties && (
                                            <div className="flex items-start gap-2">
                                                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                                <div>
                                                    <span className="font-semibold block">{appointment.properties.title}</span>
                                                    <span className="text-xs text-muted-foreground block truncate max-w-[200px]">
                                                        {appointment.properties.address?.full_address || 'Endereço não informado'}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {appointment.contacts && (
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                                <span>{appointment.contacts.name}</span>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap gap-2">
                                            {(() => {
                                                const appointmentDate = new Date(appointment.starts_at)
                                                const isToday = appointment.status === 'scheduled' && appointmentDate >= now && appointmentDate <= endOfToday
                                                const isNext48 = appointment.status === 'scheduled' && appointmentDate > endOfToday && appointmentDate <= next48h
                                                if (!isToday && !isNext48) return null
                                                return (
                                                    <Badge variant={isToday ? 'default' : 'secondary'}>
                                                        {isToday ? 'Hoje' : 'Próximas 48h'}
                                                    </Badge>
                                                )
                                            })()}
                                        </div>

                                        {appointment.notes && (
                                            <div className="mt-2 pt-2 border-t text-xs text-muted-foreground italic">
                                                &quot;{appointment.notes}&quot;
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )
            )}
        </div>
    )
}
