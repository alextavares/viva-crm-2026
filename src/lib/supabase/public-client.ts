import { createBrowserClient } from "@supabase/ssr"
import { processLock } from "@supabase/auth-js"
import { fetchWithTimeout } from "@/lib/supabase/fetch-timeout"

// Public (anon) browser client:
// - No session persistence
// - No auto-refresh timers
// This avoids auth-js lock races on public pages (e.g. `/s/...`) where we only
// need to call public RPCs using the anon key.
type PublicClient = ReturnType<typeof createBrowserClient>
const globalForSupabase = globalThis as unknown as {
  __supabasePublicBrowserClient?: PublicClient
}

export function createPublicClient() {
  if (globalForSupabase.__supabasePublicBrowserClient) return globalForSupabase.__supabasePublicBrowserClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")
  }

  globalForSupabase.__supabasePublicBrowserClient = createBrowserClient(url, key, {
    isSingleton: true,
    global: {
      fetch: fetchWithTimeout(120_000),
    },
    db: {
      timeout: 45_000,
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      // Avoid Navigator Lock API abort noise even in public pages.
      lock: (name, acquireTimeout, fn) => processLock(name, Math.max(acquireTimeout, 60_000), fn),
    },
  })

  return globalForSupabase.__supabasePublicBrowserClient
}
