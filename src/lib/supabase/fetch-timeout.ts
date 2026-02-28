// Minimal fetch wrapper that enforces an upper bound on request duration.
// This prevents auth/db calls from hanging forever and holding Supabase locks.

type TimeoutOptions = {
  defaultMs: number
  authMs?: number
  restMs?: number
  storageMs?: number
}

function toUrlString(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function resolveTimeoutMs(input: RequestInfo | URL, options: TimeoutOptions) {
  const url = toUrlString(input)
  if (url.includes("/auth/v1/")) return options.authMs ?? options.defaultMs
  if (url.includes("/storage/v1/")) return options.storageMs ?? options.defaultMs
  if (url.includes("/rest/v1/")) return options.restMs ?? options.defaultMs
  return options.defaultMs
}

export function fetchWithTimeout(timeout: number | TimeoutOptions) {
  const options: TimeoutOptions =
    typeof timeout === "number"
      ? { defaultMs: timeout }
      : timeout

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const ac = new AbortController()
    const timeoutMs = resolveTimeoutMs(input, options)

    const abortWithReason = () => {
      try {
        ac.abort(new DOMException("Request timeout", "TimeoutError"))
      } catch {
        // Fallback for environments that do not support abort(reason).
        ac.abort()
      }
    }

    const t = setTimeout(() => {
      abortWithReason()
    }, timeoutMs)

    // If the caller provided a signal, abort our controller when it aborts.
    // We can't reliably "merge" signals across all runtimes, so we propagate
    // abort in one direction and always pass our signal to fetch.
    const ext = init?.signal
    let onAbort: (() => void) | null = null
    if (ext) {
      if (ext.aborted) {
        clearTimeout(t)
        abortWithReason()
      } else {
        onAbort = () => {
          abortWithReason()
        }
        ext.addEventListener("abort", onAbort, { once: true })
      }
    }

    try {
      return await fetch(input, { ...init, signal: ac.signal })
    } finally {
      clearTimeout(t)
      if (ext && onAbort) {
        try {
          ext.removeEventListener("abort", onAbort)
        } catch {
          // ignore cleanup issues
        }
      }
    }
  }
}
