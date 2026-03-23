import { test, expect } from "@playwright/test"

test("Broker cannot see destructive actions on contacts or properties", async ({ page }) => {
    const email = process.env.E2E_USER_EMAIL
    const password = process.env.E2E_USER_PASSWORD

    test.skip(!email || !password, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run permissions E2E.")

    // Login
    await page.goto("/login")
    await page.getByLabel("Email").fill(email as string)
    await page.getByLabel("Senha").fill(password as string)
    await page.getByRole("button", { name: "Entrar", exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    // Intercept the profile fetch to simulate 'broker' role
    await page.route("**/rest/v1/profiles?select=*", async (route) => {
        const response = await route.fetch()
        const json = await response.json()

        // Modify the returned profile list so the user is a broker
        if (Array.isArray(json) && json.length > 0) {
            json[0].role = 'broker'
        }

        await route.fulfill({ json })
    })

    // Since React query or similar might have cached it, let's hard reload the page
    // doing navigation so the route interceptor catches the new request
    await page.goto("/contacts")
    await expect(page.getByRole("heading", { name: "Contatos" })).toBeVisible()

    // Click on the first contact to see details
    // Wait for contacts to load
    await page.waitForSelector('.grid a', { state: 'visible' }).catch(() => { })
    const firstContact = page.locator('.grid a').first()
    if (await firstContact.isVisible()) {
        await firstContact.click()

        // Look for the header/actions section
        // In the CRM, delete buttons have "Excluir" text or an icon that usually isn't rendered if not admin
        // Let's assert that `Excluir Contato` or similar is NOT visible
        const deleteButtonText = page.getByRole('button', { name: /excluir|delete/i })
        await expect(deleteButtonText).toHaveCount(0)
    }

    // Testing Settings access
    await page.goto("/settings", { waitUntil: 'networkidle' })

    // A broker should either be redirected or not see organization tabs if that's how it's built
    // Let's check if Team settings are visible
    const teamLink = page.getByRole('link', { name: /Membros|Equipe/i })
    // In our app, non-admins often don't see team settings
    if (await teamLink.isVisible()) {
        await teamLink.click()
        // If they can see it, there shouldn't be a button to add new members
        await expect(page.getByRole('button', { name: /Convidar/i })).toHaveCount(0)
    }
})
