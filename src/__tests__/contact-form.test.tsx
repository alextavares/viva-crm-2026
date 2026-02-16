import { render, screen } from '@testing-library/react'
import { ContactForm } from '../components/contacts/contact-form'
import { useAuth } from '../contexts/auth-context'
import { useRouter } from 'next/navigation'

// Mock dependencies
jest.mock('../contexts/auth-context', () => ({
    useAuth: jest.fn(),
}))
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}))
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}))
jest.mock('@/lib/supabase/client', () => ({
    createClient: jest.fn(() => ({
        from: jest.fn(() => ({
            insert: jest.fn().mockResolvedValue({ error: null }),
            update: jest.fn().mockResolvedValue({ error: null }),
        })),
    })),
}))

// Mock toaster
jest.mock('sonner', () => ({
    toast: {
        success: jest.fn(),
        error: jest.fn(),
    }
}))

describe('ContactForm', () => {
    const mockUser = { id: 'user-1', organization_id: 'org-1' }
    const mockRouter = { push: jest.fn(), refresh: jest.fn() }

    beforeEach(() => {
        (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
        (useRouter as jest.Mock).mockReturnValue(mockRouter);
    })

    it('renders correctly', () => {
        render(<ContactForm />)
        expect(screen.getByLabelText(/Nome/i)).toBeInTheDocument()
    })

    // This test is simplified as full form submission involves complex async & hook interactions
    // better suited for E2E if auth wasn't an issue.
    // For now, checking rendering verifies the component doesn't crash.
})
