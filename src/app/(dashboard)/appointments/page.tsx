import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, Calendar, MapPin, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AppointmentsCalendar } from '@/components/appointments/appointments-calendar'
import { LayoutGrid, Calendar as CalendarIcon } from 'lucide-react'

export default async function AppointmentsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }> // Updated type
}) {
    const supabase = await createClient()
    const resolvedSearchParams = await searchParams
    const view = resolvedSearchParams?.view as string || 'list'

    const { data: appointments, error } = await supabase
        .from('appointments')
        .select(`
            *,
            properties (title, address),
            contacts (name, phone, email),
            profiles (full_name)
        `)
        .order('date', { ascending: true })

    if (error) {
        console.error('Error fetching appointments:', error)
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
                    <Link href="/appointments?view=list">
                        <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-2">
                            <LayoutGrid className="h-4 w-4" />
                            Lista
                        </Button>
                    </Link>
                    <Link href="/appointments?view=calendar">
                        <Button variant={view === 'calendar' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-2">
                            <CalendarIcon className="h-4 w-4" />
                            Calendário
                        </Button>
                    </Link>
                </div>
            </div>

            {view === 'calendar' ? (
                <AppointmentsCalendar appointments={appointments || []} />
            ) : (
                (!appointments || appointments.length === 0) ? (
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
                        {appointments.map((appointment) => (
                            <Card key={appointment.id} className="hover:shadow-md transition-shadow">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">
                                        {formatDate(appointment.date)}
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
