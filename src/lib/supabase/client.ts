import { createBrowserClient } from '@supabase/ssr'
import { processLock } from '@supabase/auth-js'
import { fetchWithTimeout } from '@/lib/supabase/fetch-timeout'

// Singleton browser client to avoid multiple auth refresh/lock races that can surface as:
// - AbortError in `@supabase/auth-js/src/lib/locks.ts`
// - AbortError/StorageUnknownError in `@supabase/storage-js`
//
// Important: In Next dev, HMR can re-evaluate modules. Persisting on `globalThis`
// reduces the chance of multiple auto-refresh timers and lock contention.
type BrowserClient = ReturnType<typeof createBrowserClient>
const globalForSupabase = globalThis as unknown as {
    __supabaseBrowserClient?: BrowserClient
}

export function createClient() {
    if (globalForSupabase.__supabaseBrowserClient) return globalForSupabase.__supabaseBrowserClient

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }

    globalForSupabase.__supabaseBrowserClient = createBrowserClient(url, key, {
        isSingleton: true,
        global: {
            // Keep auth calls below lock acquire timeout to avoid long lock contention.
            // Storage uploads get a longer budget because files can legitimately take more time.
            fetch: fetchWithTimeout({
                defaultMs: 60_000,
                authMs: 25_000,
                restMs: 60_000,
                storageMs: 180_000,
            }),
        },
        db: {
            timeout: 45_000,
        },
        auth: {
            // Reduce noisy lock races in browser/dev while keeping behavior deterministic.
            lock: (name, acquireTimeout, fn) => processLock(name, Math.max(acquireTimeout, 120_000), fn),
        },
    })
    return globalForSupabase.__supabaseBrowserClient
}
