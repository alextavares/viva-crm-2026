import { test, expect } from '@playwright/test';

test('Login page loads', async ({ page }) => {
    await page.goto('/login');
    // Verify title "ImobCRM 49"
    await expect(page.getByText('ImobCRM 49')).toBeVisible();

    // Verify "Entrar com Google" button
    await expect(page.getByRole('button', { name: 'Entrar com Google' })).toBeVisible();

    // Verify Email/Password fields
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Senha')).toBeVisible();
});
