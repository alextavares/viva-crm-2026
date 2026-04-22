import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export type AppointmentsTabValue = 'scheduled' | 'history' | 'all'

type AppointmentsTabsProps = {
    activeTab: AppointmentsTabValue
    counts: Record<AppointmentsTabValue, number>
    buildHref: (tab: AppointmentsTabValue) => string
}

const TAB_LABELS: Record<AppointmentsTabValue, string> = {
    scheduled: 'Agendadas',
    history: 'Histórico',
    all: 'Todas',
}

const TAB_ORDER: AppointmentsTabValue[] = ['scheduled', 'history', 'all']

export function AppointmentsTabs({ activeTab, counts, buildHref }: AppointmentsTabsProps) {
    return (
        <div className="flex flex-wrap gap-2">
            {TAB_ORDER.map((tab) => (
                <Link key={tab} href={buildHref(tab)}>
                    <Button
                        variant={activeTab === tab ? 'secondary' : 'outline'}
                        size="sm"
                        className="h-9 gap-2"
                    >
                        <span>{TAB_LABELS[tab]}</span>
                        <Badge variant={activeTab === tab ? 'outline' : 'secondary'} className="px-1.5 py-0 text-[11px]">
                            {counts[tab]}
                        </Badge>
                    </Button>
                </Link>
            ))}
        </div>
    )
}
