import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ManualFollowupPanel } from '../components/followups/manual-followup-panel'
import { useRouter } from 'next/navigation'
import { createManualFollowup } from '@/app/actions/followups'

jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}))

jest.mock('sonner', () => ({
    toast: {
        success: jest.fn(),
        error: jest.fn(),
    },
}))

jest.mock('@/app/actions/followups', () => ({
    createManualFollowup: jest.fn(),
    resolveManualFollowup: jest.fn(),
}))

describe('ManualFollowupPanel datetime visibility (M008)', () => {
    const mockRouter = { push: jest.fn(), refresh: jest.fn(), replace: jest.fn() }

    beforeEach(() => {
        jest.clearAllMocks()
        ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
        ;(createManualFollowup as jest.Mock).mockResolvedValue({ success: true })
    })

    function renderPanel() {
        render(
            <ManualFollowupPanel
                contactId="00000000-0000-0000-0000-000000000001"
                canManage={true}
                now={new Date('2026-09-07T12:00:00-03:00').getTime()}
                followups={[]}
            />
        )
    }

    it('guarantees a usable minimum width for the datetime control (no starved 52px field)', () => {
        renderPanel()
        const input = screen.getByLabelText(/Data e hora do retorno/i) as HTMLInputElement
        // jsdom has no layout engine, so the enforceable contract is the
        // minimum-width + wrap mechanism on the flex row (regression of M008).
        const wrapper = input.closest('div')
        expect(wrapper?.className).toMatch(/min-w-\[220px\]/)
        const form = input.closest('form')
        expect(form?.className).toMatch(/flex-wrap/)
    })

    it('keeps a selected future date/time visible and submits it', async () => {
        renderPanel()
        const input = screen.getByLabelText(/Data e hora do retorno/i) as HTMLInputElement
        expect(input).not.toBeDisabled()

        fireEvent.change(input, { target: { value: '2030-01-15T14:30' } })
        expect(input.value).toBe('2030-01-15T14:30')

        fireEvent.change(screen.getByLabelText(/O que fazer/i), {
            target: { value: 'Ligar para confirmar a visita' },
        })
        fireEvent.click(screen.getByRole('button', { name: /Agendar retorno/i }))

        await waitFor(() => {
            expect(createManualFollowup).toHaveBeenCalledWith({
                contactId: '00000000-0000-0000-0000-000000000001',
                dueAt: '2030-01-15T14:30',
                description: 'Ligar para confirmar a visita',
            })
        })
        // Value the broker verified on screen is exactly what gets submitted.
        expect(input.value).toBe('2030-01-15T14:30')
    })
})
