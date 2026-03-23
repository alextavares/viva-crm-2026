"use client"

import { useState, useMemo } from "react"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { Clock, User, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export type CalendarAppointment = {
    id: string
    date: string
    status: string
    notes: string
    contactName: string | null
    propertyTitle: string | null
}

type Props = {
    appointments: CalendarAppointment[]
}

function formatTime(isoDate: string): string {
    try {
        const d = new Date(isoDate)
        return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    } catch {
        return "--:--"
    }
}

export function DashboardCalendar({ appointments }: Props) {
    const [date, setDate] = useState<Date | undefined>(new Date())

    // Group dates that have appointments for calendar highlighting
    const datesWithAppointments = useMemo(() => {
        const set = new Set<string>()
        for (const a of appointments) {
            set.add(new Date(a.date).toDateString())
        }
        return set
    }, [appointments])

    // Filter appointments by selected date
    const selectedDateAppointments = useMemo(() => {
        if (!date) return []
        const target = date.toDateString()
        return appointments.filter((a) => new Date(a.date).toDateString() === target)
    }, [appointments, date])

    return (
        <Card className="flex flex-col xl:flex-row shadow-sm overflow-hidden">
            <div className="border-b xl:border-b-0 xl:border-r border-border p-4 flex flex-col justify-center items-center bg-card/50">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    className="rounded-md"
                    modifiers={{ hasEvent: (d) => datesWithAppointments.has(d.toDateString()) }}
                    modifiersClassNames={{ hasEvent: "bg-primary/10 font-bold text-primary" }}
                />
            </div>
            <div className="flex-1 p-6 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-lg">Agenda do Dia</CardTitle>
                        <CardDescription>
                            {date ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(date) : "Selecione uma data"}
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" className="hidden sm:flex" asChild>
                        <Link href="/appointments">Ver Agenda</Link>
                    </Button>
                </div>

                <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 mt-2">
                    {selectedDateAppointments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/30 rounded-lg border border-dashed">
                            <Clock className="h-8 w-8 text-muted-foreground mb-2" />
                            <p className="text-sm font-medium">Agenda livre</p>
                            <p className="text-xs text-muted-foreground">Nenhum compromisso para esta data.</p>
                        </div>
                    ) : (
                        selectedDateAppointments.map((app) => (
                            <Link
                                key={app.id}
                                href={`/appointments/${app.id}`}
                                className="group relative flex gap-4 items-start rounded-xl border border-border/50 p-3 bg-card hover:bg-accent/50 hover:border-border transition-all shadow-sm"
                            >
                                <div className="flex flex-col items-center justify-center bg-primary/10 text-primary rounded-lg p-2 min-w-[60px]">
                                    <Clock className="h-4 w-4 mb-1" />
                                    <span className="text-xs font-semibold">{formatTime(app.date)}</span>
                                </div>
                                <div className="flex-1 space-y-1 py-1 min-w-0">
                                    {app.propertyTitle ? (
                                        <p className="text-sm font-semibold leading-none text-foreground truncate">{app.propertyTitle}</p>
                                    ) : (
                                        <p className="text-sm font-semibold leading-none text-foreground">Compromisso</p>
                                    )}
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                                        {app.contactName && (
                                            <span className="flex items-center gap-1 truncate">
                                                <User className="h-3 w-3 shrink-0" />
                                                {app.contactName}
                                            </span>
                                        )}
                                        {app.propertyTitle && app.contactName && (
                                            <span className="flex items-center gap-1 truncate">
                                                <Home className="h-3 w-3 shrink-0" />
                                                Visita
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <Badge
                                        variant={app.status === "completed" ? "secondary" : "default"}
                                        className="text-[10px] uppercase shadow-none font-semibold"
                                    >
                                        {app.status === "completed" ? "concluído" : "agendado"}
                                    </Badge>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
                <Button variant="outline" size="sm" className="sm:hidden mt-2 w-full" asChild>
                    <Link href="/appointments">Ver Agenda</Link>
                </Button>
            </div>
        </Card>
    )
}
