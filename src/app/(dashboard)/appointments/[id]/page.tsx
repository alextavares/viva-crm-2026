import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Calendar, MapPin, User } from 'lucide-react'
import { AppointmentActions } from './appointment-actions' // Client component for delete
import { PropertyAddress } from '@/lib/types'

export default async function AppointmentDetailsPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const supabase = await createClient()

    const { data: appointment, error } = await supabase
        .from('appointments')
        .select(`
            *,
            properties (title, address, price, type),
            contacts (name, phone, email, type),
            profiles (full_name)
        `)
        .eq('id', id)
        .single()

    if (error || !appointment) {
        notFound()
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

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'scheduled': return 'Agendado'
            case 'completed': return 'Realizado'
            case 'cancelled': return 'Cancelado'
            case 'no_show': return 'Não Compareceu'
            default: return status
        }
    }

    return (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/appointments">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold">Detalhes do Agendamento</h1>
                </div>
                <div className="flex items-center gap-2">
                    <AppointmentActions appointmentId={appointment.id} />
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-muted-foreground" />
                            Informações Básicas
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <span className="text-sm font-medium text-muted-foreground">Data e Hora</span>
                            <p className="text-lg">{formatDate(appointment.date)}</p>
                        </div>
                        <div>
                            <span className="text-sm font-medium text-muted-foreground">Status</span>
                            <div className="mt-1">
                                <Badge variant="outline">{getStatusLabel(appointment.status)}</Badge>
                            </div>
                        </div>
                        <div>
                            <span className="text-sm font-medium text-muted-foreground">Corretor Responsável</span>
                            <p>{appointment.profiles?.full_name || 'N/A'}</p>
                        </div>
                        {appointment.notes && (
                            <div>
                                <span className="text-sm font-medium text-muted-foreground">Observações</span>
                                <p className="text-sm mt-1 p-3 bg-muted rounded-md italic">
                                    {appointment.notes}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MapPin className="h-5 w-5 text-muted-foreground" />
                                Imóvel
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {appointment.properties ? (
                                <>
                                    <div>
                                        <span className="text-sm font-medium text-muted-foreground">Título</span>
                                        <p className="font-medium">{appointment.properties.title}</p>
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-muted-foreground">Endereço</span>
                                        <p className="text-sm text-muted-foreground">
                                            {(appointment.properties.address as PropertyAddress)?.full_address || 'Endereço não disponível'}
                                        </p>
                                    </div>
                                    <div>
                                        <Link href={`/properties/${appointment.property_id}`} className="text-sm text-blue-600 hover:underline">
                                            Ver detalhes do imóvel
                                        </Link>
                                    </div>
                                </>
                            ) : (
                                <p className="text-muted-foreground">Imóvel não encontrado</p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5 text-muted-foreground" />
                                Contato
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {appointment.contacts ? (
                                <>
                                    <div>
                                        <span className="text-sm font-medium text-muted-foreground">Nome</span>
                                        <p className="font-medium">{appointment.contacts.name}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-sm font-medium text-muted-foreground">Telefone</span>
                                            <p className="text-sm">{appointment.contacts.phone || '-'}</p>
                                        </div>
                                        <div>
                                            <span className="text-sm font-medium text-muted-foreground">Email</span>
                                            <p className="text-sm">{appointment.contacts.email || '-'}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <Link href={`/contacts?search=${appointment.contacts.name}`} className="text-sm text-blue-600 hover:underline">
                                            Ver contato
                                        </Link>
                                    </div>
                                </>
                            ) : (
                                <p className="text-muted-foreground">Contato não encontrado</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
