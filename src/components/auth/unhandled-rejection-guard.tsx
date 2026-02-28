"use client"

import { useEffect } from "react"

function isSupabaseLockTimeoutMessage(text: string) {
  return text.includes('Lock "lock:sb-') && text.includes("acquisition timed out")
}

function isSupabaseAbortLikeError(reason: unknown) {
  if (typeof reason === "string") {
    return reason.includes("signal is aborted") || isSupabaseLockTimeoutMessage(reason)
  }

  if (!reason || typeof reason !== "object") return false
  const r = reason as { name?: unknown; message?: unknown; stack?: unknown; cause?: unknown }
  const name = typeof r.name === "string" ? r.name : ""
  const msg = typeof r.message === "string" ? r.message : ""
  const stack = typeof r.stack === "string" ? r.stack : ""

  // Some supabase errors wrap AbortError as `cause`.
  const cause = r.cause as { name?: unknown; message?: unknown; stack?: unknown } | undefined
  const causeName = typeof cause?.name === "string" ? cause?.name : ""
  const causeMsg = typeof cause?.message === "string" ? cause?.message : ""
  const causeStack = typeof cause?.stack === "string" ? cause?.stack : ""

  const abortHint =
    msg.includes("signal is aborted") ||
    msg.includes("Request timeout") ||
    isSupabaseLockTimeoutMessage(msg) ||
    stack.includes("@supabase/auth-js") ||
    stack.includes("auth-js") ||
    stack.includes("@supabase/storage-js") ||
    causeMsg.includes("signal is aborted") ||
    causeMsg.includes("Request timeout") ||
    isSupabaseLockTimeoutMessage(causeMsg) ||
    causeStack.includes("@supabase/auth-js") ||
    causeStack.includes("@supabase/storage-js")

  if (!abortHint) return false

  // Only ignore abort-related noise.
  return (
    name === "AbortError" ||
    causeName === "AbortError" ||
    name === "StorageUnknownError" ||
    name === "AuthRetryableFetchError" ||
    name === "TimeoutError" ||
    isSupabaseLockTimeoutMessage(msg) ||
    isSupabaseLockTimeoutMessage(causeMsg)
  )
}

export function UnhandledRejectionGuard() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return

    const rejectionHandler = (event: PromiseRejectionEvent) => {
      if (isSupabaseAbortLikeError(event.reason)) {
        event.preventDefault()
      }
    }

    const errorHandler = (event: Event) => {
      // Only handle ErrorEvent that carries an Error-like object.
      const e = event as ErrorEvent
      const reason = (e && typeof e === "object" ? (e.error ?? e.message) : null) as unknown

      if (isSupabaseAbortLikeError(reason)) {
        // Prevent Next dev overlay + browser default logging for known abort-noise.
        if (typeof (e as { preventDefault?: unknown }).preventDefault === "function") e.preventDefault()
        if (typeof (e as { stopImmediatePropagation?: unknown }).stopImmediatePropagation === "function") e.stopImmediatePropagation()
      }
    }

    // Some dev overlays are triggered by `console.error(...)`. Keep this extremely narrow
    // to avoid hiding real problems.
    const originalConsoleError = console.error.bind(console)
    const originalConsoleWarn = console.warn.bind(console)
    console.error = (...args: unknown[]) => {
      for (const a of args) {
        if (isSupabaseAbortLikeError(a)) return
        if (typeof a === "string" && a.includes("signal is aborted")) return
        if (typeof a === "string" && isSupabaseLockTimeoutMessage(a)) return
      }
      originalConsoleError(...args)
    }
    console.warn = (...args: unknown[]) => {
      for (const a of args) {
        if (isSupabaseAbortLikeError(a)) return
        if (typeof a === "string" && a.includes("signal is aborted")) return
        if (typeof a === "string" && isSupabaseLockTimeoutMessage(a)) return
      }
      originalConsoleWarn(...args)
    }

    window.addEventListener("unhandledrejection", rejectionHandler)
    // Capture phase to run before framework-level handlers.
    window.addEventListener("error", errorHandler, true)

    return () => {
      window.removeEventListener("unhandledrejection", rejectionHandler)
      window.removeEventListener("error", errorHandler, true)
      console.error = originalConsoleError
      console.warn = originalConsoleWarn
    }
  }, [])

  return null
}
