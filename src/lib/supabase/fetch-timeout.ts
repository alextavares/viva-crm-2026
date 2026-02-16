// Minimal fetch wrapper that enforces an upper bound on request duration.
// This prevents auth/db calls from hanging forever and holding Supabase locks.

export function fetchWithTimeout(timeoutMs: number) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const ac = new AbortController()
    const t = setTimeout(() => {
      try {
        ac.abort()
      } catch {
        // ignore
      }
    }, timeoutMs)

    // If the caller provided a signal, abort our controller when it aborts.
    // We can't reliably "merge" signals across all runtimes, so we propagate
    // abort in one direction and always pass our signal to fetch.
    const ext = init?.signal
    if (ext) {
      if (ext.aborted) {
        clearTimeout(t)
        ac.abort()
      } else {
        const onAbort = () => {
          try {
            ac.abort()
          } catch {
            // ignore
          }
        }
        ext.addEventListener("abort", onAbort, { once: true })
      }
    }

    try {
      return await fetch(input, { ...init, signal: ac.signal })
    } finally {
      clearTimeout(t)
    }
  }
}

