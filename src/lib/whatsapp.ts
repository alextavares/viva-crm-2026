export function digitsOnly(input: string): string {
  return input.replace(/[^0-9]/g, "")
}

function stripInternationalPrefixes(digits: string): string {
  let v = digits
  if (v.startsWith("00")) v = v.slice(2)
  v = v.replace(/^0+/, "")
  return v
}

// Produces the number format required by https://wa.me/<number> (digits only, with country code).
// For Brazil-centric usage, we default to country code 55 if the user typed only DDD + number.
export function waMeNumberFromPhone(
  rawPhone: string,
  defaultCountryCode = "55",
): string | null {
  const d = digitsOnly(rawPhone)
  if (!d) return null

  let v = stripInternationalPrefixes(d)
  if (!v) return null

  // If user typed local BR phone (DDD + number), prepend country code.
  // 10 = (DD) + 8 digits, 11 = (DD) + 9 digits
  if (v.length === 10 || v.length === 11) {
    v = `${defaultCountryCode}${v}`
  }

  // Require at least: country code + area code + number.
  if (v.length < 12) return null

  return v
}

export function buildWhatsAppUrl(opts: {
  phone: string
  message?: string | null
  defaultCountryCode?: string
}): string | null {
  const number = waMeNumberFromPhone(opts.phone, opts.defaultCountryCode)
  if (!number) return null

  const base = `https://wa.me/${number}`
  const msg = (opts.message ?? "").trim()
  if (!msg) return base

  return `${base}?text=${encodeURIComponent(msg)}`
}

