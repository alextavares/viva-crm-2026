'use client'

import { useEffect } from 'react'
import { AlertCircle } from 'lucide-react'

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('Global error:', error)
    }, [error])

    return (
        <html>
            <body>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    padding: '2rem',
                    textAlign: 'center',
                    fontFamily: 'system-ui, sans-serif',
                    backgroundColor: '#fafafa',
                }}>
                    <div style={{
                        backgroundColor: '#fee2e2',
                        borderRadius: '50%',
                        padding: '1rem',
                        marginBottom: '1rem',
                    }}>
                        <AlertCircle style={{ width: 32, height: 32, color: '#dc2626' }} />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                        Algo deu errado
                    </h2>
                    <p style={{ color: '#6b7280', maxWidth: '28rem', marginBottom: '1.5rem' }}>
                        Ocorreu um erro inesperado. Tente recarregar a página.
                    </p>
                    <button
                        onClick={reset}
                        style={{
                            padding: '0.5rem 1.5rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.375rem',
                            backgroundColor: '#fff',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                        }}
                    >
                        Tentar Novamente
                    </button>
                </div>
            </body>
        </html>
    )
}
