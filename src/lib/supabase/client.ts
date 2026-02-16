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

    // Use a process-level lock in the browser to avoid Navigator Lock API abort noise in dev
    // ("signal is aborted without reason" from auth-js locks.ts). We still get mutual exclusion
    // within the current tab/process, which is enough for our low-touch CRM UX.
    globalForSupabase.__supabaseBrowserClient = createBrowserClient(url, key, {
        isSingleton: true,
        global: {
            // Ensure auth/REST calls never hang forever and keep locks held.
            // Use a more lenient timeout here because Storage uploads can take longer on slow networks.
            // Save operations use explicit abort signals in the UI for responsiveness.
            fetch: fetchWithTimeout(120_000),
        },
        db: {
            timeout: 45_000,
        },
        auth: {
            lock: (name, acquireTimeout, fn) =>
                processLock(name, Math.max(acquireTimeout, 60_000), fn),
        },
    })
    return globalForSupabase.__supabaseBrowserClient
}
