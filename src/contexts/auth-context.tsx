'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { type AuthChangeEvent, User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { UserRole } from '@/lib/types'

interface AuthContextType {
    user: User | null
    session: Session | null
    loading: boolean
    role: UserRole | null
    organizationId: string | null
    signInWithGoogle: () => Promise<void>
    signInWithPassword: (email: string, password: string) => Promise<void>
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

function isAbortError(err: unknown) {
    return (
        typeof err === 'object' &&
        err !== null &&
        'name' in err &&
        (err as { name?: unknown }).name === 'AbortError'
    )
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)
    const [role, setRole] = useState<UserRole | null>(null)
    const [organizationId, setOrganizationId] = useState<string | null>(null)
    const router = useRouter()
    const [supabase] = useState(() => createClient())

    /** Fetch role + org from profiles table */
    const fetchProfile = async (userId: string) => {
        const { data } = await supabase
            .from('profiles')
            .select('role, organization_id')
            .eq('id', userId)
            .single()
        setRole((data?.role as UserRole) ?? null)
        setOrganizationId(data?.organization_id ?? null)
    }

    useEffect(() => {
        const checkSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                setSession(session)
                setUser(session?.user ?? null)
                if (session?.user) {
                    await fetchProfile(session.user.id)
                }
            } catch (err) {
                // Avoid crashing the UI on rare auth-js lock races.
                if (!isAbortError(err)) {
                    console.error('Auth getSession error:', err)
                }
            } finally {
                setLoading(false)
            }
        }

        checkSession()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event: AuthChangeEvent, session: Session | null) => {
                try {
                    setSession(session)
                    setUser(session?.user ?? null)
                    if (session?.user) {
                        await fetchProfile(session.user.id)
                    } else {
                        setRole(null)
                        setOrganizationId(null)
                    }
                } catch (err) {
                    if (!isAbortError(err)) {
                        console.error('Auth state change error:', err)
                    }
                } finally {
                    setLoading(false)
                }

                if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
                    router.refresh()
                }
            }
        )

        return () => {
            subscription.unsubscribe()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router, supabase])

    const signInWithGoogle = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        })
    }

    const signInWithPassword = async (email: string, password: string) => {
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            })
            if (error) {
                throw error
            }
            router.refresh()
            router.push('/dashboard')
        } catch (err) {
            if (isAbortError(err)) {
                throw new Error('Sessão indisponível no momento. Tente novamente.')
            }
            throw err
        }
    }

    const signOut = async () => {
        try {
            await supabase.auth.signOut()
        } catch (err) {
            // Even if signOut fails (rare), allow navigation to login.
            if (!isAbortError(err)) {
                console.error('Error signing out:', err)
            }
        } finally {
            setRole(null)
            setOrganizationId(null)
            setUser(null)
            setSession(null)
            router.refresh()
            router.replace('/login')
        }
    }

    return (
        <AuthContext.Provider value={{ user, session, loading, role, organizationId, signInWithGoogle, signInWithPassword, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    return useContext(AuthContext)
}

