import {
    canEditContactDealStage,
    canCreateProposalForContact,
    canDeleteProposalRecord,
    canEditProposalRecord,
    contractSchema,
    DEAL_STAGES,
    DEAL_STAGE_LABELS,
    isTerminalDealStage,
    PROPERTY_TYPES,
    contactSchema,
    getPropertyTypeLabel,
    propertySchema,
    proposalSchema,
} from '../lib/types'

describe('Zod Schemas Validation', () => {
    describe('contactSchema', () => {
        it('validates a valid contact', () => {
            const validContact = {
                name: 'John Doe',
                email: 'john@example.com',
                phone: '1234567890',
                city: 'São Sebastião',
                type: 'lead',
                status: 'new',
                interest_type: 'condominium_house',
                interest_bedrooms: 3,
                interest_price_max: 1500000,
                notes: 'Some notes'
            }
            expect(contactSchema.safeParse(validContact).success).toBe(true)
        })

        it('invalidates short name', () => {
            const invalidContact = {
                name: 'Jo',
                email: 'john@example.com'
            }
            const result = contactSchema.safeParse(invalidContact)

            if (!result.success) {
                if (result.error && Array.isArray(result.error.issues)) {

                    const msg = result.error.issues[0]?.message;
                    expect(msg).toContain('pelo menos 3 caracteres');
                } else {

                    expect(result.error).toBeDefined();
                }
            } else {
                expect(result.success).toBe(false)
            }
        })

        it('invalidates invalid email', () => {
            const invalidContact = {
                name: 'John Doe',
                email: 'not-an-email'
            }
            const result = contactSchema.safeParse(invalidContact)
            expect(result.success).toBe(false)
        })

        it('rejects unknown property type in interest profile', () => {
            const invalidContact = {
                name: 'John Doe',
                type: 'lead',
                status: 'new',
                interest_type: 'warehouse'
            }
            const result = contactSchema.safeParse(invalidContact)
            expect(result.success).toBe(false)
        })
    })

    describe('propertySchema', () => {
        it('exposes the expanded fixed property taxonomy', () => {
            expect(PROPERTY_TYPES).toEqual(
                expect.arrayContaining(['condominium_house', 'commercial_space'])
            )
            expect(getPropertyTypeLabel('condominium_house')).toBe('Casa em condomínio')
            expect(getPropertyTypeLabel('commercial_space')).toBe('Espaço comercial')
        })

        it('validates a valid property', () => {
            const validProperty = {
                title: 'Nice Apartment',
                description: 'A great place',
                price: 500000,
                type: 'apartment',
                owner_contact_id: '550e8400-e29b-41d4-a716-446655440000',
                status: 'available',
                bedrooms: 2,
                bathrooms: 1,
                area: 70,
                address: '123 Main St',
                images: []
            }
            expect(propertySchema.safeParse(validProperty).success).toBe(true)
        })

        it('accepts property without linked owner contact', () => {
            const validProperty = {
                title: 'Casa sem vínculo',
                price: 700000,
                type: 'house',
                owner_contact_id: '',
                status: 'available',
                bedrooms: 3,
                bathrooms: 2,
                area: 120,
                images: [],
            }
            expect(propertySchema.safeParse(validProperty).success).toBe(true)
        })

        it('requires positive price', () => {
            const invalidProperty = {
                title: 'Nice Apartment',
                price: -100
            }
            const result = propertySchema.safeParse(invalidProperty)
            expect(result.success).toBe(false)
        })
    })

    describe('proposalSchema and deal stages', () => {
        it('exposes the commercial deal stages centrally', () => {
            expect(DEAL_STAGES).toEqual(
                expect.arrayContaining(['lead', 'interest', 'visit', 'negotiation', 'closing', 'won', 'lost'])
            )
            expect(DEAL_STAGE_LABELS.negotiation).toBe('Negociação')
            expect(DEAL_STAGE_LABELS.closing).toBe('Fechamento')
        })

        it('validates a valid proposal payload', () => {
            const validProposal = {
                property_id: '',
                proposed_value: 350000,
                payment_conditions: 'Entrada + financiamento',
                valid_until: '2026-04-01',
                status: 'pending',
                notes: 'Cliente pediu retorno em 48h',
            }
            expect(proposalSchema.safeParse(validProposal).success).toBe(true)
        })

        it('rejects invalid proposal status', () => {
            const invalidProposal = {
                proposed_value: 350000,
                status: 'draft_contract',
            }
            expect(proposalSchema.safeParse(invalidProposal).success).toBe(false)
        })

        it('applies create vs edit permissions for manager and broker', () => {
            expect(canCreateProposalForContact('manager', 'u1', null)).toBe(true)
            expect(canCreateProposalForContact('broker', 'u1', 'u1')).toBe(true)
            expect(canCreateProposalForContact('broker', 'u1', 'u2')).toBe(false)

            expect(canEditProposalRecord('manager', 'u1', 'u2')).toBe(true)
            expect(canEditProposalRecord('broker', 'u1', 'u1')).toBe(true)
            expect(canEditProposalRecord('broker', 'u1', 'u2')).toBe(false)
        })

        it('keeps delete manager-only', () => {
            expect(canDeleteProposalRecord('owner')).toBe(true)
            expect(canDeleteProposalRecord('manager')).toBe(true)
            expect(canDeleteProposalRecord('broker')).toBe(false)
        })

        it('applies manual deal stage permissions for manager and assigned broker', () => {
            expect(canEditContactDealStage('manager', 'u1', null)).toBe(true)
            expect(canEditContactDealStage('broker', 'u1', 'u1')).toBe(true)
            expect(canEditContactDealStage('broker', 'u1', 'u2')).toBe(false)
            expect(canEditContactDealStage('assistant', 'u1', 'u1')).toBe(false)
        })

        it('treats won and lost as terminal deal stages', () => {
            expect(isTerminalDealStage('won')).toBe(true)
            expect(isTerminalDealStage('lost')).toBe(true)
            expect(isTerminalDealStage('closing')).toBe(false)
            expect(isTerminalDealStage(null)).toBe(false)
        })
    })

    describe('contractSchema', () => {
        it('validates the current contract payload shape used by the contract form', () => {
            const validContract = {
                id: 'ctr_123',
                organization_id: 'org_123',
                contact_id: 'contact_123',
                property_id: 'property_123',
                assigned_to: 'broker_123',
                proposal_id: 'proposal_123',
                contract_type: 'sale',
                final_value: 850000,
                commission_value: 42500,
                status: 'draft',
                start_date: '2026-03-28T10:00:00.000Z',
                end_date: '',
                document_url: '',
            }

            expect(contractSchema.safeParse(validContract).success).toBe(true)
        })

        it('accepts null optional fields from contract records', () => {
            const contractWithNullOptionals = {
                organization_id: 'org_123',
                contact_id: 'contact_123',
                property_id: 'property_123',
                assigned_to: null,
                proposal_id: null,
                contract_type: 'sale',
                final_value: 850000,
                commission_value: null,
                status: 'draft',
                start_date: null,
                end_date: null,
                document_url: null,
            }

            expect(contractSchema.safeParse(contractWithNullOptionals).success).toBe(true)
        })
    })
})
