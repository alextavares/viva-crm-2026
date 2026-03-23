"use client"

import { useState } from "react"
import Link from "next/link"
import { MapPin, User } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AppointmentQuickActions } from "./appointment-quick-actions"
import { AppointmentCardActions } from "./appointment-card-actions"

export type AppointmentListRow = {
    id: string
    date: string
    status: string
    notes?: string | null
    properties?: {
        title?: string | null
        address?: Record<string, unknown> | null
    } | null
    contacts?: {
        name?: string | null
        phone?: string | null
        email?: string | null
    } | null
    profiles?: {
        full_name?: string | null
    } | null
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
        case 'completed': return 'secondary'
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

const getRelativeDay = (dateString: string): { label: string; className: string } | null => {
    const now = new Date()
    const d = new Date(dateString)
    const todayStr = now.toDateString()
    const tomorrowDate = new Date(now)
    tomorrowDate.setDate(tomorrowDate.getDate() + 1)

    if (d.toDateString() === todayStr) {
        return { label: 'Hoje', className: 'text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400' }
    }
    if (d.toDateString() === tomorrowDate.toDateString()) {
        return { label: 'Amanhã', className: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400' }
    }
    if (d < now) {
        return { label: 'Passado', className: 'text-muted-foreground bg-muted' }
    }
    return null
}

export function AppointmentsGrid({ appointments }: { appointments: AppointmentListRow[] }) {
    if (!appointments || appointments.length === 0) return null

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {appointments.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
            ))}
        </div>
    )
}

function AppointmentCard({ appointment }: { appointment: AppointmentListRow }) {
    const [isDeleted, setIsDeleted] = useState(false)
    const [optimisticStatus, setOptimisticStatus] = useState<string>(appointment.status)

    if (isDeleted) return null

    return (
        <div className="relative group h-full">
            <Link href={`/appointments/${appointment.id}`} className="block h-full">
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pr-12">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-sm font-medium">
                                {formatDate(appointment.date)}
                            </CardTitle>
                            {(() => {
                                const rel = getRelativeDay(appointment.date)
                                return rel ? (
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${rel.className}`}>
                                        {rel.label}
                                    </span>
                                ) : null
                            })()}
                        </div>
                        <Badge variant={getStatusColor(optimisticStatus) as "default" | "secondary" | "destructive" | "outline"}>
                            {getStatusLabel(optimisticStatus)}
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
                                            {(appointment.properties.address && typeof (appointment.properties.address as Record<string, unknown>).full_address === 'string' ? (appointment.properties.address as Record<string, unknown>).full_address as string : null) || 'Endereço não informado'}
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
                                <div className="mt-2 pt-2 border-t text-xs text-muted-foreground italic line-clamp-2">
                                    &quot;{appointment.notes}&quot;
                                </div>
                            )}
                        </div>

                        <div className="mt-4 pt-3 border-t flex items-center justify-end" onClick={(e) => e.preventDefault()}>
                            <AppointmentQuickActions
                                appointmentId={appointment.id}
                                status={optimisticStatus}
                                onOptimisticUpdate={(newStatus) => setOptimisticStatus(newStatus)}
                                onRevertUpdate={() => setOptimisticStatus(appointment.status)}
                            />
                        </div>
                    </CardContent>
                </Card>
            </Link>
            <AppointmentCardActions
                appointmentId={appointment.id}
                onOptimisticDelete={() => setIsDeleted(true)}
                onRevertDelete={() => setIsDeleted(false)}
            />
        </div>
    )
}
