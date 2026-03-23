async function runTest() {
    const orgSlug = 'bb9c5e0d-5d06-4d75-bfc7-16f49693a76b';
    const token = 'test-token-123';
    const baseUrl = 'http://localhost:3015/api/public/webhooks';

    const iwPayload = {
        name: "João Imovelweb",
        email: "joao@iw.com",
        phone: "11988881111",
        message: "Interesse no seu imóvel de teste IW",
        listingId: "TESTE-IW-001"
    };

    const zapPayload = {
        name: "Maria Zap",
        email: "maria@zap.com",
        phone: "11977772222",
        message: "Vi no Zap e gostei",
        listing: { externalId: "TESTE-IW-001" }
    };

    console.log('--- TESTANDO IMOVELWEB ---');
    try {
        const resIW = await fetch(`${baseUrl}/${orgSlug}/imovelweb?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(iwPayload)
        });
        console.log('Status IW:', resIW.status);
        console.log('Resposta IW:', await resIW.json());
    } catch (e: any) { console.error('Erro IW:', e.message); }

    console.log('\n--- TESTANDO ZAP ---');
    try {
        const resZap = await fetch(`${baseUrl}/${orgSlug}/zap?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(zapPayload)
        });
        console.log('Status Zap:', resZap.status);
        console.log('Resposta Zap:', await resZap.json());
    } catch (e: any) { console.error('Erro Zap:', e.message); }
}

runTest();
