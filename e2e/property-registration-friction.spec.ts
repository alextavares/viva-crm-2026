import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { createBrowserClient } from "@supabase/ssr"
import { expect, test, type BrowserContext } from "@playwright/test"

function loadLocalEnvValue(name: string) {
  if (process.env[name]) return process.env[name]

  const envPath = path.resolve(process.cwd(), ".env.local")
  if (!existsSync(envPath)) return undefined

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/)
  for (const line of lines) {
    if (!line.startsWith(`${name}=`)) continue
    return line.slice(name.length + 1).trim()
  }

  return undefined
}

async function authenticateLocalSession(context: BrowserContext, email: string, password: string) {
  const supabaseUrl = loadLocalEnvValue("NEXT_PUBLIC_SUPABASE_URL")
  const supabaseAnonKey = loadLocalEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY")

  if (!supabaseUrl || !supabaseAnonKey) {
    test.skip(true, "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for local auth.")
    return
  }

  const authCookies: Array<{
    name: string
    value: string
    options?: {
      path?: string
      httpOnly?: boolean
      maxAge?: number
    }
  }> = []

  const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return authCookies
      },
      setAll(nextCookies) {
        authCookies.splice(0, authCookies.length, ...nextCookies)
      },
    },
  })

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    throw error
  }

  await context.addCookies(
    authCookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: "localhost",
      path: cookie.options?.path || "/",
      sameSite: "Lax" as const,
      httpOnly: Boolean(cookie.options?.httpOnly),
      expires: Math.floor(Date.now() / 1000) + (cookie.options?.maxAge || 3600),
    }))
  )
}

test("owner can create a property with quick owner flow and save without friction", async ({ browser, page }) => {
  test.setTimeout(120000)

  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD
  const baseURL = (process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/$/, "")

  test.skip(!email || !password, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD.")

  const stamp = Date.now().toString()
  const propertyTitle = `QA Cadastro Sem Atrito ${stamp.slice(-6)}`
  const ownerName = `Maria Proprietária ${stamp.slice(-4)}`

  await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" })
  await authenticateLocalSession(page.context(), email as string, password as string)
  await page.goto(`${baseURL}/dashboard`, { waitUntil: "domcontentloaded" })
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 })

  await page.goto(`${baseURL}/properties/new`, { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: /Novo imóvel/i })).toBeVisible({ timeout: 30000 })

  await page.locator("#property-title").fill(propertyTitle)
  await page.locator("#property-price").fill("850000")
  await page.locator("#property-area").fill("120")
  await page.locator("#property-bedrooms").fill("3")
  await page.locator("#property-bathrooms").fill("2")

  await page.getByRole("button", { name: /Proprietário/i }).first().click()
  await page.getByRole("button", { name: /Novo proprietário/i }).click()
  await page.locator("#property-owner-quick-name").fill(ownerName)
  await page.locator("#property-owner-quick-phone").fill("11999999999")
  await page.getByRole("button", { name: /Criar proprietário/i }).click()
  await expect(page.locator("#property-owner")).toContainText(ownerName, { timeout: 30000 })
  await expect(page.getByText(`Proprietário selecionado: ${ownerName}`)).toBeVisible({ timeout: 30000 })

  await page.getByRole("button", { name: /Localização/i }).first().click()
  await page.locator("#address_neighborhood").fill("Centro")
  await page.locator("#address_city").fill("São Paulo")
  await page.getByPlaceholder("Ex: SP").fill("SP")

  await page.getByRole("button", { name: /Comercial/i }).first().click()
  await page.locator("#property-description").fill(
    "Apartamento amplo, com boa iluminação natural, localização central e pronto para visitas."
  )

  await page.getByRole("button", { name: /Cadastrar imóvel/i }).click()
  await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}(?:\?|$)/, { timeout: 30000 })
  await expect(page.getByRole("heading", { name: /Editar Imóvel/i })).toBeVisible({ timeout: 30000 })
  await expect(page.locator("#property-title")).toHaveValue(propertyTitle, { timeout: 30000 })
  await expect(page.getByText(ownerName)).toBeVisible({ timeout: 30000 })

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
  const mobilePage = await mobileContext.newPage()
  await authenticateLocalSession(mobileContext, email as string, password as string)
  await mobilePage.goto(`${baseURL}/dashboard`, { waitUntil: "domcontentloaded" })
  await expect(mobilePage).toHaveURL(/\/dashboard/, { timeout: 30000 })
  await mobilePage.goto(`${baseURL}/properties/new`, { waitUntil: "domcontentloaded" })
  await expect(mobilePage.getByRole("heading", { name: /Novo imóvel/i })).toBeVisible({ timeout: 30000 })

  const overflow = await mobilePage.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  expect(overflow).toBeLessThanOrEqual(0)

  await mobileContext.close()
})
