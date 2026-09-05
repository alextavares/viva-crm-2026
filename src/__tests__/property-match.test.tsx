import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import {
    PropertyMatchSheet,
    computeScore,
    normalizeCityText,
    isCityMatch,
    normalizeMatchRow,
} from '@/components/contacts/property-match-sheet'
import { createClient } from '@/lib/supabase/client'

jest.mock('@/lib/supabase/client', () => ({
    createClient: jest.fn(),
}))

describe('Property Matching Utilities', () => {
    describe('normalizeCityText and isCityMatch', () => {
        it('normalizes accents, spaces, and case', () => {
            expect(normalizeCityText('São Sebastião')).toBe('sao sebastiao')
            expect(normalizeCityText('  são   sebastião  ')).toBe('sao sebastiao')
            expect(normalizeCityText('SÃO SEBASTIÃO')).toBe('sao sebastiao')
            expect(normalizeCityText(null)).toBe('')
            expect(normalizeCityText(undefined)).toBe('')
        })

        it('correctly matches cities with and without diacritics', () => {
            expect(isCityMatch('São Sebastião', 'sao sebastiao')).toBe(true)
            expect(isCityMatch('sao sebastiao', 'São Sebastião')).toBe(true)
            expect(isCityMatch('Ilhabela', 'ilhabela')).toBe(true)
            expect(isCityMatch('São Sebastião', 'Caraguatatuba')).toBe(false)
            expect(isCityMatch(null, 'São Sebastião')).toBe(false)
            expect(isCityMatch('São Sebastião', null)).toBe(false)
        })
    })

    describe('computeScore', () => {
        const baseProperty = {
            id: 'prop-1',
            title: 'Imóvel Teste',
            public_code: 'P-001',
            type: 'apartment',
            transaction_type: 'sale',
            city: 'São Sebastião',
            neighborhood: 'Centro',
            price: 750000,
            bedrooms: 2,
        }

        it('gives at least 25 points for a city-only match (passing the 20 threshold)', () => {
            const score = computeScore(baseProperty, {
                city: 'sao sebastiao',
                interest_type: null,
                interest_bedrooms: null,
                interest_price_max: null,
            })
            expect(score).toBe(25)
            expect(score).toBeGreaterThanOrEqual(20)
        })

        it('accumulates score for multi-criteria match', () => {
            const fullMatchScore = computeScore(baseProperty, {
                city: 'São Sebastião',
                interest_type: 'apartment',
                interest_bedrooms: 2,
                interest_price_max: 800000,
            })
            // 25 (city) + 35 (type) + 25 (bedrooms) + 25 (price) = 110 -> capped at 100
            expect(fullMatchScore).toBe(100)
        })

        it('gives 0 points if property is in a different city and has no matching criteria', () => {
            const score = computeScore(baseProperty, {
                city: 'Ubatuba',
                interest_type: 'house',
                interest_bedrooms: 4,
                interest_price_max: 300000,
            })
            expect(score).toBe(0)
        })
    })

    describe('normalizeMatchRow', () => {
        it('normalizes property address and features', () => {
            const row = {
                id: 'prop-1',
                title: 'Casa',
                public_code: 'C-1',
                type: 'house',
                transaction_type: 'sale',
                price: 500000,
                status: 'available',
                organization_id: 'org-1',
                address: { city: 'São Sebastião', neighborhood: 'Maresias' },
                features: ['bedrooms:3', 'bathrooms:2'],
            }
            const normalized = normalizeMatchRow(row as unknown as Parameters<typeof normalizeMatchRow>[0])
            expect(normalized.city).toBe('São Sebastião')
            expect(normalized.neighborhood).toBe('Maresias')
            expect(normalized.bedrooms).toBe(3)
        })
    })
})

describe('PropertyMatchSheet Component', () => {
    interface MockQueryChain {
        from: jest.Mock
        select: jest.Mock
        eq: jest.Mock
        limit: jest.Mock
    }
    let mockSupabase: MockQueryChain

    beforeEach(() => {
        jest.clearAllMocks()
        mockSupabase = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
        };
        (createClient as jest.Mock).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createClient>)
    })

    it('renders the trigger button initially', () => {
        render(
            <PropertyMatchSheet
                contactId="contact-1"
                organizationId="org-1"
                contactProfile={{ city: 'São Sebastião' }}
            />
        )
        expect(screen.getByRole('button', { name: /Buscar imóveis compatíveis/i })).toBeInTheDocument()
    })

    it('settles to terminal state with insufficient criteria when no criteria are provided', async () => {
        render(
            <PropertyMatchSheet
                contactId="contact-1"
                organizationId="org-1"
                contactProfile={{ city: null, interest_type: null, interest_bedrooms: null, interest_price_max: null }}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: /Buscar imóveis compatíveis/i }))

        await waitFor(() => {
            expect(screen.getByText(/Este contato ainda não tem perfil de interesse suficiente/i)).toBeInTheDocument()
        })
        // Must NOT remain loading
        expect(screen.queryByText(/Buscando imóveis compatíveis.../i)).not.toBeInTheDocument()
    })

    it('settles to terminal state with matched results when properties match the city', async () => {
        mockSupabase.limit.mockResolvedValue({
            data: [
                {
                    id: 'prop-1',
                    title: 'Apartamento Frente Mar',
                    public_code: 'V-001',
                    type: 'apartment',
                    transaction_type: 'sale',
                    price: 750000,
                    status: 'available',
                    organization_id: 'org-1',
                    address: { city: 'São Sebastião', neighborhood: 'Centro' },
                    features: ['bedrooms:2'],
                },
            ],
            error: null,
        })

        render(
            <PropertyMatchSheet
                contactId="contact-1"
                organizationId="org-1"
                contactProfile={{ city: 'sao sebastiao' }}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: /Buscar imóveis compatíveis/i }))

        await waitFor(() => {
            expect(screen.getByText('Apartamento Frente Mar')).toBeInTheDocument()
        })
        expect(screen.getByText(/1 imóveis compatíveis encontrados/i)).toBeInTheDocument()
        expect(screen.queryByText(/Buscando imóveis compatíveis.../i)).not.toBeInTheDocument()
    })

    it('settles to explicit no matches terminal state when no properties match', async () => {
        mockSupabase.limit.mockResolvedValue({
            data: [],
            error: null,
        })

        render(
            <PropertyMatchSheet
                contactId="contact-1"
                organizationId="org-1"
                contactProfile={{ city: 'sao sebastiao' }}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: /Buscar imóveis compatíveis/i }))

        await waitFor(() => {
            expect(screen.getByText(/Nenhum imóvel compatível encontrado com o perfil atual/i)).toBeInTheDocument()
        })
        expect(screen.queryByText(/Buscando imóveis compatíveis.../i)).not.toBeInTheDocument()
    })

    it('settles to handled error terminal state when Supabase query fails and does NOT hang', async () => {
        mockSupabase.limit.mockResolvedValue({
            data: null,
            error: { message: 'Network error connecting to database' },
        })

        render(
            <PropertyMatchSheet
                contactId="contact-1"
                organizationId="org-1"
                contactProfile={{ city: 'sao sebastiao' }}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: /Buscar imóveis compatíveis/i }))

        await waitFor(() => {
            expect(screen.getByText(/Não foi possível carregar os imóveis compatíveis/i)).toBeInTheDocument()
        })
        expect(screen.getByRole('button', { name: /Tentar novamente/i })).toBeInTheDocument()
        expect(screen.queryByText(/Buscando imóveis compatíveis.../i)).not.toBeInTheDocument()
    })

    it('settles to handled error terminal state when an exception is thrown', async () => {
        mockSupabase.limit.mockRejectedValue(new Error('Fatal connection drop'))

        render(
            <PropertyMatchSheet
                contactId="contact-1"
                organizationId="org-1"
                contactProfile={{ city: 'sao sebastiao' }}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: /Buscar imóveis compatíveis/i }))

        await waitFor(() => {
            expect(screen.getByText(/Erro inesperado ao buscar imóveis compatíveis/i)).toBeInTheDocument()
        })
        expect(screen.queryByText(/Buscando imóveis compatíveis.../i)).not.toBeInTheDocument()
    })
})
