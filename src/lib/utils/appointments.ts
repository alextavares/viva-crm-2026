
export const getStatusLabel = (status: string) => {
    switch (status) {
        case 'scheduled': return 'Agendado'
        case 'completed': return 'Realizado'
        case 'cancelled': return 'Cancelado'
        case 'no_show': return 'Não Compareceu'
        default: return status
    }
}

export const getStatusColor = (status: string) => {
    switch (status) {
        case 'scheduled': return 'default'
        case 'completed': return 'secondary'
        case 'cancelled': return 'destructive'
        case 'no_show': return 'outline'
        default: return 'outline'
    }
}

export const formatAppointmentDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

export const getRelativeDay = (dateString: string): { label: string; className: string } | null => {
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
