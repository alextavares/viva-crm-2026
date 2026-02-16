'use client'

import { useMemo } from 'react'
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, addHours } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { type Appointment } from '@/lib/types'

const locales = {
    'pt-BR': ptBR,
}

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
})

interface AppointmentsCalendarProps {
    appointments: Appointment[]
}

interface CalendarEvent {
    id: string
    title: string
    start: Date
    end: Date
    resource: Appointment
    status: string
}

export function AppointmentsCalendar({ appointments }: AppointmentsCalendarProps) {
    const router = useRouter()

    const events = useMemo(() => {
        return appointments.map(apt => {
            const startDate = new Date(apt.date)
            return {
                id: apt.id,
                title: `${apt.contacts?.name || 'Cliente'} - ${apt.properties?.title || 'Imóvel'}`,
                start: startDate,
                end: addHours(startDate, 1),
                resource: apt,
                status: apt.status
            }
        })
    }, [appointments])

    const eventStyleGetter = (event: CalendarEvent) => {
        let backgroundColor = '#3b82f6'
        if (event.status === 'completed') backgroundColor = '#10b981'
        if (event.status === 'cancelled') backgroundColor = '#ef4444'
        if (event.status === 'no_show') backgroundColor = '#6b7280'

        return {
            style: {
                backgroundColor,
                borderRadius: '4px',
                opacity: 0.8,
                color: 'white',
                border: '0px',
                display: 'block'
            }
        }
    }

    return (
        <Card className="p-4 h-[600px]">
            <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '100%' }}
                culture="pt-BR"
                messages={{
                    next: 'Próximo',
                    previous: 'Anterior',
                    today: 'Hoje',
                    month: 'Mês',
                    week: 'Semana',
                    day: 'Dia',
                    agenda: 'Agenda',
                    date: 'Data',
                    time: 'Hora',
                    event: 'Evento',
                    noEventsInRange: 'Não há eventos neste período.',
                }}
                eventPropGetter={eventStyleGetter}
                defaultView={Views.MONTH}
                onSelectEvent={(event) => router.push(`/appointments/${event.id}`)}
            />
        </Card>
    )
}
