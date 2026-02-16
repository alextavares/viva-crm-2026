import { test, expect, type Page } from '@playwright/test'

async function dragCardToColumn(
    page: Page,
    cardTestId: string,
    columnTestId: string
) {
    const source = page.getByTestId(cardTestId)
    const target = page.getByTestId(columnTestId)

    await expect(source).toBeVisible()
    await expect(target).toBeVisible()

    const sourceBox = await source.boundingBox()
    const targetBox = await target.boundingBox()

    if (!sourceBox || !targetBox) {
        throw new Error('Could not resolve drag/drop bounding boxes')
    }

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 })
    await page.mouse.up()
}

test('Kanban optimistic move updates UI immediately', async ({ page }) => {
    await page.route('**/rest/v1/contacts*', async (route) => {
        if (route.request().method() !== 'PATCH') {
            await route.continue()
            return
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: '{}',
        })
    })

    await page.goto('/public/kanban-e2e')
    await expect(page.getByText('Kanban E2E Fixture')).toBeVisible()

    const newColumn = page.getByTestId('kanban-column-new')
    const contactedColumn = page.getByTestId('kanban-column-contacted')
    await expect(newColumn.getByTestId('kanban-card-lead-1')).toBeVisible()
    await dragCardToColumn(page, 'kanban-card-lead-1', 'kanban-column-contacted')

    await expect(contactedColumn.getByTestId('kanban-card-lead-1')).toBeVisible()
    await expect(newColumn.getByTestId('kanban-card-lead-1')).toHaveCount(0)
    await expect(page.getByText('Status atualizado com sucesso!')).toBeVisible()
})

test('Kanban reverts move when API update fails', async ({ page }) => {
    await page.route('**/rest/v1/contacts*', async (route) => {
        if (route.request().method() !== 'PATCH') {
            await route.continue()
            return
        }

        await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'forced error for e2e' }),
        })
    })

    await page.goto('/public/kanban-e2e')
    await expect(page.getByText('Kanban E2E Fixture')).toBeVisible()

    const newColumn = page.getByTestId('kanban-column-new')
    const contactedColumn = page.getByTestId('kanban-column-contacted')

    await expect(newColumn.getByTestId('kanban-card-lead-1')).toBeVisible()
    await dragCardToColumn(page, 'kanban-card-lead-1', 'kanban-column-contacted')

    await expect(page.getByText('Erro ao atualizar status. Desfazendo alterações.')).toBeVisible()
    await expect(newColumn.getByTestId('kanban-card-lead-1')).toBeVisible()
    await expect(contactedColumn.getByTestId('kanban-card-lead-1')).toHaveCount(0)
})
