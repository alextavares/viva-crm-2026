import { test, expect } from "@playwright/test"

test("owner properties portfolio shows consistent vitrine state between list and detail", async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD
  const baseURL = process.env.E2E_BASE_URL?.replace(/\/$/, "") ?? ""

  test.skip(!email || !password, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run this smoke.")

  await page.goto(`${baseURL}/login`)
  await page.getByLabel("Email").fill(email as string)
  await page.getByLabel("Senha").fill(password as string)
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 })

  await page.goto(`${baseURL}/properties?siteReadiness=blocked`)
  await expect(page.getByText("Recorte ativo").first()).toBeVisible()
  await expect(page.getByText(/Publicação: com pendências/).first()).toBeVisible()

  const emptyState = page.getByText("Nenhum imóvel encontrado")
  test.skip(await emptyState.isVisible(), "No blocked properties available in this environment.")

  await expect(page.locator("span:visible", { hasText: /Com pendências|Oculto com pendências|Publicado com pendências/ }).first()).toBeVisible()

  const propertyLink = page
    .locator(
      'table a[href^="/properties/"]:not([href="/properties/new"]):not([href="/properties/import"]):not([href="/properties/publish"]):visible'
    )
    .first()

  await propertyLink.click()
  await expect(page).toHaveURL(/\/properties\/[^/?#]+/)
  await expect(page.locator("span:visible", { hasText: /Com pendências|Oculto com pendências|Publicado com pendências/ }).first()).toBeVisible()
  await expect(page.getByText("Publicado no site")).toHaveCount(0)
})
