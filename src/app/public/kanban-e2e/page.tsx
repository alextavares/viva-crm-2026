import { LeadsKanban } from '@/components/leads/leads-kanban'
import type { EnrichedContactRow } from '@/components/contacts/contacts-grid'

const fixtureContacts: EnrichedContactRow[] = [
    {
        id: 'lead-1',
        organization_id: 'org-e2e',
        name: 'Lead E2E Novo',
        email: 'lead-novo@e2e.test',
        phone: '11999990001',
        status: 'new',
        type: 'lead',
        created_at: new Date().toISOString(),
    },
    {
        id: 'lead-2',
        organization_id: 'org-e2e',
        name: 'Lead E2E Em atendimento',
        email: 'lead-contactado@e2e.test',
        phone: '11999990002',
        status: 'contacted',
        type: 'lead',
        created_at: new Date().toISOString(),
    },
]

export default function KanbanE2EPage() {
    return (
        <main className="p-6">
            <h1 className="text-xl font-semibold mb-4">Kanban E2E Fixture</h1>
            <LeadsKanban
                initialData={fixtureContacts}
                leadDistributionSettings={{ enabled: false, sla_minutes: 15 }}
                shouldRefreshOnSuccess={false}
            />
        </main>
    )
}
