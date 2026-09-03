import { expect, test } from "@playwright/test"

test("broker opens WhatsApp with property context and timeline trace", async ({ page }) => {
  const brokerEmail = process.env.E2E_BROKER_EMAIL || process.env.E2E_USER_EMAIL
  const brokerPassword = process.env.E2E_BROKER_PASSWORD || process.env.E2E_USER_PASSWORD
  const baseURL = (process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/$/, "")
  const propertyId = process.env.E2E_PROPERTY_ID || "44444444-4444-4444-4444-444444444444"

  test.skip(!brokerEmail || !brokerPassword, "Set broker E2E credentials.")

  const stamp = Date.now().toString()
  const leadName = `QA WhatsApp Trace ${stamp.slice(-6)}`
  const leadPhone = `119${stamp.slice(-8)}`
  const propertyDetailUrl = `${baseURL}/s/demo-vivacrm/imovel/${propertyId}`

  await page.goto(propertyDetailUrl)
  await page.getByPlaceholder("Seu nome").fill(leadName)
  await page.getByPlaceholder("(11) 99999-9999").fill(leadPhone)
  await page.locator("textarea").fill(`Interesse no imóvel do teste ${stamp}`)
  await page.getByRole("button", { name: "Enviar", exact: true }).click()
  await expect(
    page.getByText("Recebemos sua mensagem. Nossa equipe vai retornar pelo WhatsApp informado.")
  ).toBeVisible({ timeout: 30000 })

  await page.goto(`${baseURL}/login`)
  await page.getByLabel("Email").fill(brokerEmail as string)
  await page.getByLabel("Senha").fill(brokerPassword as string)
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 })

  await page.goto(`${baseURL}/contacts/site?q=${leadPhone}`)
  await expect(page.getByText(leadPhone).first()).toBeVisible({ timeout: 30000 })
  await page.getByRole("link", { name: /Abrir ficha/i }).first().click()
  await expect(page).toHaveURL(/\/contacts\/(?!site(?:[/?#]|$))[^/?#]+/, { timeout: 30000 })

  await page.evaluate(() => {
    ;(window as typeof window & { __lastOpenedUrl?: string | null }).__lastOpenedUrl = null
    window.open = ((url?: string | URL, target?: string, features?: string) => {
      if (url) {
        ;(window as typeof window & { __lastOpenedUrl?: string | null }).__lastOpenedUrl = String(url)
        return null
      }

      const fakePopup = {
        location: {
          set href(nextUrl: string) {
            ;(window as typeof window & { __lastOpenedUrl?: string | null }).__lastOpenedUrl = nextUrl
          },
          get href() {
            return (window as typeof window & { __lastOpenedUrl?: string | null }).__lastOpenedUrl ?? ""
          },
        },
        close() {},
      }

      return fakePopup as Window
    }) as typeof window.open
  })

  await page.getByRole("button", { name: "Abrir WhatsApp", exact: true }).click()
  await expect
    .poll(async () => {
      return page.evaluate(() => (window as typeof window & { __lastOpenedUrl?: string | null }).__lastOpenedUrl ?? "")
    })
    .toMatch(/wa\.me/)

  const popupUrl = decodeURIComponent(
    await page.evaluate(() => (window as typeof window & { __lastOpenedUrl?: string | null }).__lastOpenedUrl ?? "")
  )
  expect(popupUrl).toMatch(/QA|interesse/i)
  expect(popupUrl).toMatch(/imóvel|imovel|Ref\./i)

  await page.reload()
  await expect(page.getByText(/WhatsApp externo aberto/).first()).toBeVisible({ timeout: 30000 })
})
