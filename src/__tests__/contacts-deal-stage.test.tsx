import { render, screen } from '@testing-library/react'
import { ContactsGrid, type EnrichedContactRow, type LeadDistributionSettings } from '../components/contacts/contacts-grid'
import { ContactsList } from '../components/contacts/contacts-list'

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

jest.mock('../components/contacts/contact-card-actions', () => ({
    ContactActions: () => <div>actions mock</div>,
}))

jest.mock('../components/contacts/contact-list-primary-action', () => ({
    ContactListPrimaryAction: () => <div>primary action mock</div>,
}))

jest.mock('../components/contacts/site-contact-quick-actions', () => ({
    SiteContactQuickActions: () => <div>site quick actions mock</div>,
}))

const leadDistributionSettings: LeadDistributionSettings = {
    sla_minutes: 15,
    enabled: true,
}

const contact: EnrichedContactRow = {
    id: 'contact-1',
    name: 'Maria Souza',
    email: 'maria@example.com',
    phone: '(11) 99999-9999',
    status: 'contacted',
    type: 'lead',
    deal_stage: 'negotiation',
    organization_id: 'org-1',
    city: 'São Paulo',
    created_at: '2026-03-27T10:00:00.000Z',
    latestLeadAt: null,
    siteMeta: {
        source: 'site',
        domain: 'www.vivacrm.com.br',
        lastEventAt: '2026-03-27T10:00:00.000Z',
    },
    leadPropertyContext: {
        id: 'property-1',
        title: '[V-101] Apartamento Vista Mar',
    },
}

describe('Contacts deal stage visibility', () => {
    it('renders deal stage in the contacts list', () => {
        render(<ContactsList contacts={[contact]} leadDistributionSettings={leadDistributionSettings} />)

        expect(screen.getByText(/Em atendimento/i)).toBeInTheDocument()
        expect(screen.getByText(/Negociação/i)).toBeInTheDocument()
    })

    it('renders deal stage in the contacts grid', () => {
        render(<ContactsGrid contacts={[contact]} leadDistributionSettings={leadDistributionSettings} />)

        expect(screen.getByText(/Em atendimento/i)).toBeInTheDocument()
        expect(screen.getByText(/Negociação/i)).toBeInTheDocument()
    })

    it('renders the lead property context when site lead has known property', () => {
        render(<ContactsList contacts={[contact]} leadDistributionSettings={leadDistributionSettings} />)

        expect(screen.getByText(/Imóvel: \[V-101\] Apartamento Vista Mar/i)).toBeInTheDocument()
        expect(screen.queryByText(/Interesse não identificado/i)).not.toBeInTheDocument()
    })
})
