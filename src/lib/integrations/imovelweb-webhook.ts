import { createHash } from "node:crypto"

/**
 * Deterministic Imovelweb webhook event id for idempotency. Prefers an
 * explicit portal event id; otherwise derives a stable sha256 from bounded
 * sender/listing/message parts so retried deliveries dedupe inside
 * `api.imovelweb_ingest` instead of double-inserting.
 */
export function deriveImovelwebEventId(args: {
  eventId?: string | null
  phoneNorm?: string | null
  listingRef?: string | null
  message?: string | null
}): string {
  const explicit = (args.eventId ?? "").trim().slice(0, 200)
  if (explicit) return explicit
  const basis = [args.phoneNorm ?? "", args.listingRef ?? "", args.message ?? ""].join("|")
  return `derived-${createHash("sha256").update(basis).digest("hex").slice(0, 48)}`
}
