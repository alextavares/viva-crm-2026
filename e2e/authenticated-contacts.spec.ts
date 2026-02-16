import { test, expect } from '@playwright/test'

test('Authenticated user can open contacts kanban', async ({ page }) => {
    const email = process.env.E2E_USER_EMAIL
    const password = process.env.E2E_USER_PASSWORD

    test.skip(!email || !password, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated E2E')

    await page.goto('/login')
    await page.getByLabel('Email').fill(email as string)
    await page.getByLabel('Senha').fill(password as string)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()

    await expect(page).toHaveURL(/\/dashboard/)

    await page.goto('/contacts?view=board')
    await expect(page.getByRole('heading', { name: 'Contatos' })).toBeVisible()
    await expect(page.getByTestId('kanban-root')).toBeVisible()
})
