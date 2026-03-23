
$orgSlug = "bb9c5e0d-5d06-4d75-bfc7-16f49693a76b"
$token = "test-token-123"
$baseUrl = "http://127.0.0.1:3015/api/public/webhooks"

$iwPayload = @{
    name      = "Joao Imovelweb"
    email     = "joao@iw.com"
    phone     = "11988881111"
    message   = "Interesse no seu imovel de teste IW"
    listingId = "TESTE-IW-001"
} | ConvertTo-Json

$zapPayload = @{
    name    = "Maria Zap"
    email   = "maria@zap.com"
    phone   = "11977772222"
    message = "Vi no Zap e gostei"
    listing = @{ externalId = "TESTE-IW-001" }
} | ConvertTo-Json

Write-Host "--- TESTANDO IMOVELWEB ---"
try {
    $resIW = Invoke-RestMethod -Uri "$baseUrl/$orgSlug/imovelweb?token=$token" -Method Post -Body $iwPayload -ContentType "application/json"
    Write-Host "Resposta IW:" ($resIW | ConvertTo-Json)
}
catch {
    Write-Host "Erro IW: $($_.Exception.Message)"
}

Write-Host "`n--- TESTANDO ZAP ---"
try {
    $resZap = Invoke-RestMethod -Uri "$baseUrl/$orgSlug/zap?token=$token" -Method Post -Body $zapPayload -ContentType "application/json"
    Write-Host "Resposta Zap:" ($resZap | ConvertTo-Json)
}
catch {
    Write-Host "Erro Zap: $($_.Exception.Message)"
}
