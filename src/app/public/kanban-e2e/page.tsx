import { LeadsKanban } from '@/components/leads/leads-kanban'
import type { Contact } from '@/lib/types'

const fixtureContacts: Contact[] = [
    {
        id: 'lead-1',
        organization_id: 'org-e2e',
        name: 'Lead E2E Novo',
        email: 'lead-novo@e2e.test',
        phone: '11999990001',
        status: 'new',
        type: 'lead',
    },
    {
        id: 'lead-2',
        organization_id: 'org-e2e',
        name: 'Lead E2E Contactado',
        email: 'lead-contactado@e2e.test',
        phone: '11999990002',
        status: 'contacted',
        type: 'lead',
    },
]

export default function KanbanE2EPage() {
    return (
        <main className="p-6">
            <h1 className="text-xl font-semibold mb-4">Kanban E2E Fixture</h1>
            <LeadsKanban initialData={fixtureContacts} shouldRefreshOnSuccess={false} />
        </main>
    )
}
