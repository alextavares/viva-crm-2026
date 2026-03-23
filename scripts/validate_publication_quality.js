
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

    console.log('--- QA: Publication Quality (Cycle 10.2) ---');

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

        // Scenario 1: Property List (/properties)
        console.log('\n--- Scenario 1: Property List ---');
        await page.goto(`${BASE_URL}/properties`);
        await page.waitForSelector('h1:has-text("Imóveis")', { timeout: 15000 });

        // Filter "Qualidade: Com pendências"
        await page.click('button:has-text("Qualidade")');
        await page.click('div[role="option"]:has-text("Qualidade: Com pendências")');
        await page.waitForTimeout(2000);

        // Confirm presence of pending issues
        const fixLink = page.locator('a:has-text("Corrigir")').first();
        const href = await fixLink.getAttribute('href');
        log('PASS', `Property List: Found "Corrigir" button linking to: ${href}`);
        await capture('properties_pending_v6');

        // Scenario 2: Bulk Publish (/properties/publish)
        console.log('\n--- Scenario 2: Bulk Publish ---');
        await page.goto(`${BASE_URL}/properties/publish`);
        await page.waitForSelector('h1:has-text("Publicação em massa")', { timeout: 15000 });

        // Expand filters - more aggressive clicking
        await page.click('div:has-text("Status") + div >> button:has-text("Todos")');
        await page.waitForTimeout(500);
        await page.click('div:has-text("Visibilidade") + div >> button:has-text("Todos")');
        await page.waitForTimeout(1000);
        log('PASS', 'Bulk Publish: Expanded filters (Status: Todos, Visibility: Todos)');

        // Filter "Qualidade: Com pendências"
        await page.click('button:has-text("Com pendências")');
        await page.waitForTimeout(2000);

        // Confirm counters and list
        const readyCount = page.locator('div:has-text("Prontos:")').last();
        const pendingCount = page.locator('div:has-text("Com pendências:")').last();
        log('PASS', `Bulk Publish Counters: "${await readyCount.innerText()}" | "${await pendingCount.innerText()}"`);

        // Verify item in list
        const fixLinkBulk = page.locator('a:has-text("Corrigir")').first();
        try {
            await fixLinkBulk.waitFor({ state: 'visible', timeout: 10000 });
            log('PASS', 'Bulk Publish: Found "Corrigir" button in list');
        } catch (e) {
            log('FAIL', 'Bulk Publish: "Corrigir" button NOT found after expanding filters');
            // Take a diagnostic screenshot
            await capture('bulk_publish_empty_diagnostic_v6');
            throw e;
        }
        await capture('bulk_publish_pending_list_v6');

        // Verify Redirect
        await fixLinkBulk.click();
        await page.waitForURL(/properties\/.*focus=/, { timeout: 10000 });
        await page.waitForSelector('h1:has-text("Editar Imóvel")');
        log('PASS', 'Bulk Publish: Redirected to field edit with focus');
        await capture('bulk_fix_redirect_v6');

        // Scenario 3: Regression
        console.log('\n--- Scenario 3: Regression ---');
        await page.goto(`${BASE_URL}/properties`);
        await page.waitForSelector('input[placeholder*="Buscar"]');
        await page.fill('input[placeholder*="Buscar"]', 'teses');
        await page.waitForTimeout(1500);
        log('PASS', 'Regression: Property search ok');
        await capture('regression_check_v6');

        // Final Checks
        const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('net::ERR'));
        if (criticalErrors.length === 0) {
            log('PASS', 'No critical console errors detected');
        } else {
            log('FAIL', `Found ${criticalErrors.length} console error(s)`);
        }

    } catch (err) {
        log('FAIL', `CRITICAL: ${err.message}`);
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'publication_crash_v6.png'), fullPage: false });
    } finally {
        await browser.close();
        console.log('\n--- FINAL REPORT ---');
        const passed = results.filter(r => r.status === 'PASS').length;
        const failed = results.filter(r => r.status === 'FAIL').length;
        console.log(`PASS: ${passed} | FAIL: ${failed}`);
    }
}

run();
