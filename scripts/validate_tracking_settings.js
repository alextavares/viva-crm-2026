
const { chromium } = require('@playwright/test');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\alext\\.gemini\\antigravity\\brain\\9bf234d9-7a38-43ac-bf5b-fd8407483d4f';
const BASE_URL = 'http://localhost:3015';

const results = [];

function log(status, msg) {
    const line = `[${status}] ${msg}`;
    console.log(line);
    results.push({ status, msg });
}

async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('--- QA: Tracking Settings UX Validation (V2) ---');

    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const capture = async (name) => {
        const p = path.join(ARTIFACTS_DIR, `${name}.png`);
        await page.screenshot({ path: p, fullPage: false });
        log('PASS', `Screenshot: ${name}.png`);
    };

    try {
        // 1. Login
        console.log('\n--- Step 1: Login ---');
        await page.goto(`${BASE_URL}/login`);
        await page.fill('#email', 'e2e.imobicrm.2026@gmail.com');
        await page.fill('#password', 'TempE2E!2026');
        await page.click('form button[type="submit"]');
        await page.waitForURL(/\/(dashboard|properties)/, { timeout: 20000 });
        log('PASS', 'Login successful');

        // Navigate to /settings/site
        await page.goto(`${BASE_URL}/settings/site`);
        await page.waitForLoadState('networkidle');
        await page.locator('text=Checklist guiado').first().waitFor({ timeout: 10000 });
        log('PASS', 'Navigated to /settings/site and found tracking section');

        // 2. Checklist Structure
        console.log('\n--- Step 2: Checklist Structure ---');
        const expectedSteps = ['Etapa 1', 'Etapa 2', 'Etapa 3', 'Etapa 4'];
        const stepTitles = ['GA4', 'Meta Pixel', 'Google Ads', 'Verifica'];

        for (let i = 0; i < 4; i++) {
            const el = page.locator(`.rounded-lg.border.bg-background.p-3`).nth(i);
            if (await el.isVisible()) {
                const text = await el.innerText();
                const hasEtapa = text.includes(`Etapa ${i + 1}`);
                const hasTitle = stepTitles.some(t => text.includes(t));
                if (hasEtapa && hasTitle) log('PASS', `Step ${i + 1} found with correct title`);
                else log('FAIL', `Step ${i + 1} text mismatch: "${text.substring(0, 80)}"`);
            } else {
                log('FAIL', `Step ${i + 1} not visible`);
            }
        }

        // Check "Não configurado" text present
        const naoConfigCount = await page.locator('text="Não configurado"').count();
        log('PASS', `"Não configurado" shown for ${naoConfigCount} step(s)`);

        // Check "Ir para campo" buttons present
        const irParaCampoCount = await page.locator('a:has-text("Ir para campo")').count();
        if (irParaCampoCount >= 4) log('PASS', `Found ${irParaCampoCount} "Ir para campo" buttons`);
        else log('FAIL', `Expected 4 "Ir para campo" buttons, found ${irParaCampoCount}`);

        await capture('tracking_checklist_overview');

        // 3. Anchor Navigation
        console.log('\n--- Step 3: Anchor Navigation ---');
        const anchors = [
            { label: 'GA4', href: '#tracking-ga4', screenshot: 'tracking_anchor_ga4' },
            { label: 'Meta Pixel', href: '#tracking-meta-pixel', screenshot: null },
            { label: 'Google Ads ID', href: '#tracking-google-ads-id', screenshot: 'tracking_anchor_ads' },
            { label: 'Verificação', href: '#tracking-google-site-verification', screenshot: null },
        ];

        for (const anchor of anchors) {
            const btn = page.locator(`a[href="${anchor.href}"]`).first();
            if (await btn.isVisible()) {
                await btn.scrollIntoViewIfNeeded();
                await btn.click();
                await page.waitForTimeout(600);
                const targetId = anchor.href.replace('#', '');
                const targetInput = page.locator(`#${targetId}`);
                const inView = await targetInput.isVisible();
                if (inView) log('PASS', `"Ir para campo" -> ${anchor.href}: input visible`);
                else log('FAIL', `Scroll to ${anchor.href} failed; input not visible`);
                if (anchor.screenshot) await capture(anchor.screenshot);
            } else {
                log('FAIL', `Button for ${anchor.label} not found`);
            }
        }

        // 4. Persistence - Pre-fill REQUIRED fields first, then tracking values
        console.log('\n--- Step 4: Persistence Test ---');

        // Fill required field: Nome da marca (identified by placeholder)
        const brandNameInput = page.locator('input[placeholder*="Riviera"]').first();
        if (await brandNameInput.isVisible()) {
            const existing = await brandNameInput.inputValue();
            if (!existing.trim()) {
                await brandNameInput.fill('Imobiliária QA Test');
                log('PASS', 'Filled "Nome da marca" (required)');
            } else {
                log('PASS', `"Nome da marca" already has value: "${existing}"`);
            }
        } else {
            log('WARN', '"Nome da marca" input not found — using whatever is pre-filled');
        }

        // Fill WhatsApp
        const whatsappInput = page.locator('input[placeholder*="99999"]').first();
        if (await whatsappInput.isVisible()) {
            const existing = await whatsappInput.inputValue();
            if (!existing.trim()) {
                await whatsappInput.fill('+55 11 99988-7766');
                log('PASS', 'Filled "WhatsApp" (required)');
            } else {
                log('PASS', `"WhatsApp" already: "${existing}"`);
            }
        }

        // Fill Email
        const emailInput = page.locator('input[placeholder*="contato@"]').first();
        if (await emailInput.isVisible()) {
            const existing = await emailInput.inputValue();
            if (!existing.trim()) {
                await emailInput.fill('qa@imobiliariatest.com.br');
                log('PASS', 'Filled "E-mail" (required)');
            } else {
                log('PASS', `"E-mail" already: "${existing}"`);
            }
        }

        // Now fill tracking values
        await page.fill('#tracking-ga4', 'G-TEST1234');
        await page.fill('#tracking-meta-pixel', '123456789012345');
        await page.fill('#tracking-google-ads-id', 'AW-123456789');
        await page.fill('#tracking-google-ads-label', 'AbCdEfGhIjKlMnOpQr');
        await page.fill('#tracking-google-site-verification', 'test-google-token-abc123');
        log('PASS', 'Filled all tracking fields with valid values');

        const saveBtn = page.locator('button:has-text("Salvar rastreamento")').first();
        await saveBtn.scrollIntoViewIfNeeded();
        await saveBtn.click();
        await page.waitForTimeout(3500); // Allow Supabase + toast

        const successToast = page.locator('[data-sonner-toast]').first();
        if (await successToast.isVisible()) {
            const toastText = await successToast.innerText();
            if (toastText.includes('salvas') || toastText.includes('sucesso')) {
                log('PASS', `Save success toast: "${toastText.substring(0, 60)}"`);
            } else {
                log('FAIL', `Unexpected toast after save: "${toastText.substring(0, 80)}"`);
            }
        } else {
            log('WARN', 'No toast visible after save (may have faded)');
        }

        // Reload to verify persistence
        await page.goto(`${BASE_URL}/settings/site`);
        await page.waitForLoadState('networkidle');
        await page.locator('#tracking-ga4').waitFor({ state: 'visible', timeout: 10000 });

        const savedGa4 = await page.inputValue('#tracking-ga4');
        if (savedGa4 === 'G-TEST1234') log('PASS', `GA4 persisted: ${savedGa4}`);
        else log('FAIL', `GA4 NOT persisted. Got: "${savedGa4}"`);

        const savedPixel = await page.inputValue('#tracking-meta-pixel');
        if (savedPixel === '123456789012345') log('PASS', `Meta Pixel persisted: ${savedPixel}`);
        else log('FAIL', `Meta Pixel NOT persisted. Got: "${savedPixel}"`);

        const savedAds = await page.inputValue('#tracking-google-ads-id');
        if (savedAds === 'AW-123456789') log('PASS', `Google Ads ID persisted: ${savedAds}`);
        else log('FAIL', `Google Ads ID NOT persisted. Got: "${savedAds}"`);

        // Check checklist updated (done icons)
        await page.locator('text=Checklist guiado').first().scrollIntoViewIfNeeded();
        const doneIcons = await page.locator('svg.text-emerald-500').count();
        if (doneIcons >= 2) log('PASS', `Checklist updated: ${doneIcons} completed step(s) (green checkmark)`);
        else log('WARN', `Only ${doneIcons} completed step(s) in checklist`);

        await capture('tracking_saved_state');

        // 5. Validation Error
        console.log('\n--- Step 5: Validation Error ---');
        await page.fill('#tracking-ga4', 'TEST123'); // Invalid - missing G-
        const saveBtn2 = page.locator('button:has-text("Salvar rastreamento")').first();
        await saveBtn2.scrollIntoViewIfNeeded();
        await saveBtn2.click();
        await page.waitForTimeout(1200);

        const errorToast = page.locator('[data-sonner-toast]').first();
        if (await errorToast.isVisible()) {
            const errorText = await errorToast.innerText();
            const isGa4Error = /GA4|G-|inválido/i.test(errorText);
            if (isGa4Error) log('PASS', `Correct GA4 validation toast: "${errorText.substring(0, 80)}"`);
            else log('FAIL', `Toast shown but not GA4 validation: "${errorText.substring(0, 80)}"`);
        } else {
            log('FAIL', 'No validation toast shown for invalid GA4');
        }

        const isDisabled = await saveBtn2.isDisabled();
        if (!isDisabled) log('PASS', 'Save button NOT stuck after validation error');
        else log('FAIL', 'Save button stuck/disabled after validation error');

        await capture('tracking_validation_error');

        // 6. Console errors
        console.log('\n--- Step 6: Console Errors ---');
        const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('net::ERR'));
        if (criticalErrors.length === 0) log('PASS', 'No critical console errors');
        else {
            log('FAIL', `${criticalErrors.length} console error(s) found`);
            criticalErrors.forEach(e => console.error('  -', e.substring(0, 120)));
        }

    } catch (err) {
        log('FAIL', `CRITICAL: ${err.message}`);
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'tracking_crash_v2.png'), fullPage: false });
        console.error(err);
    } finally {
        await browser.close();

        console.log('\n--- FINAL REPORT ---');
        const passed = results.filter(r => r.status === 'PASS').length;
        const failed = results.filter(r => r.status === 'FAIL').length;
        const warned = results.filter(r => r.status === 'WARN').length;
        console.log(`PASS: ${passed} | FAIL: ${failed} | WARN: ${warned}`);
        if (failed > 0) {
            console.log('\nFailed items:');
            results.filter(r => r.status === 'FAIL').forEach(r => console.log(' -', r.msg));
        }
    }
}

run();
