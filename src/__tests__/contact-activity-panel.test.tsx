import { render, screen } from '@testing-library/react'
import { ContactActivityPanel } from '../components/contacts/contact-activity-panel'

jest.mock('../components/contacts/contact-interaction-form', () => ({
    ContactInteractionForm: () => <div>Interaction form mock</div>,
}))

describe('ContactActivityPanel', () => {
    it('renders a unified timeline with messages, events and interactions', () => {
        render(
            <ContactActivityPanel
                contactId="00000000-0000-0000-0000-000000000001"
                messages={[
                    {
                        id: 'msg-1',
                        direction: 'out',
                        channel: 'whatsapp',
                        body: 'Mensagem enviada',
                        created_at: '2026-03-27T10:00:00.000Z',
                    },
                ]}
                events={[
                    {
                        id: 'evt-1',
                        type: 'lead_received',
                        source: 'site',
                        payload: null,
                        created_at: '2026-03-27T09:00:00.000Z',
                    },
                ]}
                interactions={[
                    {
                        id: 'int-1',
                        type: 'call',
                        direction: 'outbound',
                        summary: 'Ligação para confirmar visita',
                        happened_at: '2026-03-27T11:00:00.000Z',
                        profiles: { full_name: 'Maria Corretora' },
                    },
                ]}
            />
        )

        expect(screen.getByText(/Timeline do Contato/i)).toBeInTheDocument()
        expect(screen.getByText(/Interaction form mock/i)).toBeInTheDocument()
        expect(screen.getByText(/Mensagem enviada/i)).toBeInTheDocument()
        expect(screen.getByText(/Lead recebido\./i)).toBeInTheDocument()
        expect(screen.getByText(/Ligação para confirmar visita/i)).toBeInTheDocument()
        expect(screen.getByText(/Maria Corretora/i)).toBeInTheDocument()
        expect(screen.getAllByText(/Ligação/i).length).toBeGreaterThan(0)
    })

    it('shows an external badge for traced external WhatsApp attempts', () => {
        render(
            <ContactActivityPanel
                contactId="00000000-0000-0000-0000-000000000001"
                messages={[]}
                events={[]}
                interactions={[
                    {
                        id: 'int-whatsapp-1',
                        type: 'whatsapp',
                        direction: 'outbound',
                        summary: 'WhatsApp externo aberto com contexto do imóvel "Apartamento demo" (Ref. DEMO-001).',
                        happened_at: '2026-03-27T11:00:00.000Z',
                        profiles: { full_name: 'Maria Corretora' },
                    },
                ]}
            />
        )

        expect(screen.getByText(/WhatsApp externo aberto com contexto/i)).toBeInTheDocument()
        expect(screen.getByText(/^Externo$/i)).toBeInTheDocument()
    })
})
