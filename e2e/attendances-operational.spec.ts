import { expect, test } from "@playwright/test"

test("broker can use attendance queue to find next action", async ({ page }) => {
  const email = process.env.E2E_BROKER_EMAIL || process.env.E2E_USER_EMAIL
  const password = process.env.E2E_BROKER_PASSWORD || process.env.E2E_USER_PASSWORD
  const baseURL = (process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/$/, "")

  test.skip(!email || !password, "Set broker E2E credentials.")

  await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" })
  await page.getByLabel("Email").fill(email as string)
  await page.getByLabel("Senha").fill(password as string)
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 })

  await page.goto(`${baseURL}/attendances`, { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Atendimentos" })).toBeVisible({ timeout: 30000 })
  await expect(page.getByText("Atendimentos no recorte").first()).toBeVisible()
  await expect(
    page
      .getByText(
        /Fazer primeiro contato|Responder lead atrasado|Qualificar e propor visita|Confirmar visita agendada|Fazer follow-up/
      )
      .first()
  ).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
