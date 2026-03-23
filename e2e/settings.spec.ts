import { test, expect } from "@playwright/test"

test("Profile settings update", async ({ page }) => {
    const email = process.env.E2E_USER_EMAIL
    const password = process.env.E2E_USER_PASSWORD

    test.skip(!email || !password, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run settings E2E.")

    // 1. Login
    await page.goto("/login")
    await page.getByLabel("Email").fill(email as string)
    await page.getByLabel("Senha").fill(password as string)
    await page.getByRole("button", { name: "Entrar", exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    // 2. Go to Settings Profile
    await page.goto("/settings/profile")
    await expect(page.getByRole("heading", { name: "Perfil" })).toBeVisible()

    // 3. Update Name
    const newName = `Test User ${Date.now()}`
    const nameInput = page.getByLabel("Nome Completo")
    await nameInput.clear()
    await nameInput.fill(newName)

    await page.getByRole("button", { name: "Salvar Alterações" }).click()

    // Wait for success toast
    await expect(page.getByText("Perfil atualizado com sucesso")).toBeVisible()

    // Verify the new name is still in the input
    await expect(nameInput).toHaveValue(newName)
})

test("Organization settings (SLA)", async ({ page }) => {
    const email = process.env.E2E_USER_EMAIL
    const password = process.env.E2E_USER_PASSWORD

    test.skip(!email || !password, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run settings E2E.")

    await page.goto("/login")
    await page.getByLabel("Email").fill(email as string)
    await page.getByLabel("Senha").fill(password as string)
    await page.getByRole("button", { name: "Entrar", exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    // Go to Settings Organization
    await page.goto("/settings/organization")
    await expect(page.getByRole("heading", { name: "Configurações da Empresa" })).toBeVisible()

    // Check SLA Input
    const slaInput = page.getByLabel("SLA de Atendimento Inicial")
    await expect(slaInput).toBeVisible()

    // We won't alter it heavily to not mess up other tests, but we'll ensure the page loads and form is there
    await expect(page.getByRole("button", { name: "Salvar Alterações" })).toBeVisible()
})
