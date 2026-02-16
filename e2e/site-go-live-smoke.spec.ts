import { test, expect } from "@playwright/test"

test("Go-live smoke: import/publish pages + site lead + contacts", async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD
  const siteSlug = process.env.E2E_SITE_SLUG || "demo-vivacrm"

  test.skip(!email || !password, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run this smoke.")

  const leadName = `Smoke Lead ${Date.now()}`
  const leadPhone = "11988887777"

  // Auth
  await page.goto("/login")
  await page.getByLabel("Email").fill(email as string)
  await page.getByLabel("Senha").fill(password as string)
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard/)

  // Import page available
  await page.goto("/properties/import")
  await expect(page.getByRole("heading", { name: "Importar imóveis" })).toBeVisible()

  // Publish page available
  await page.goto("/properties/publish")
  await expect(page.getByRole("heading", { name: "Publicação em massa" })).toBeVisible()

  // Public site lead
  await page.goto(`/s/${siteSlug}/contact`)
  await expect(page.getByRole("heading", { name: /Contato/i })).toBeVisible()
  await page.getByPlaceholder("Seu nome").fill(leadName)
  await page.getByPlaceholder("(11) 99999-9999").fill(leadPhone)
  await page.getByPlaceholder("Olá, gostaria de mais informações.").fill("Teste smoke E2E")
  await page.getByRole("button", { name: "Enviar mensagem" }).click()
  await expect(page.getByText("Mensagem enviada com sucesso")).toBeVisible()

  // Back to CRM and check the lead appears in contacts list
  await page.goto("/contacts")
  await expect(page.getByRole("heading", { name: "Contatos" })).toBeVisible()
  await expect(page.getByText(leadName)).toBeVisible({ timeout: 15000 })
})

