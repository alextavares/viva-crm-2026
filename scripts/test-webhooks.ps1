$orgSlug = "bb9c5e0d-5d06-4d75-bfc7-16f49693a76b"
$token = "test-token-123"
$baseUrl = "http://localhost:3015"

function Test-Webhook {
    param($portal, $body)
    $url = "${baseUrl}/api/public/webhooks/${orgSlug}/${portal}?token=${token}"
    Write-Host "Testing $portal webhook: $url"
    $headers = @{ "Content-Type" = "application/json" }
    $jsonBody = $body | ConvertTo-Json
    try {
        $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $jsonBody
        Write-Host "Success: $($response | ConvertTo-Json)" -ForegroundColor Green
    }
    catch {
        Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            Write-Host "Body: $($reader.ReadToEnd())" -ForegroundColor Red
        }
    }
}

$zapBody = @{
    name    = "João Zap"
    email   = "joao@zap.com"
    phone   = "11999991111"
    message = "Interesse no imóvel ZAP-001"
    listing = @{ externalId = "ZAP-001" }
}

$iwBody = @{
    name      = "Maria Imovelweb"
    email     = "maria@imovelweb.com"
    phone     = "21988882222"
    message   = "Quero visitar o imóvel"
    listingId = "ZAP-001"
}

Test-Webhook -portal "zap" -body $zapBody
Test-Webhook -portal "imovelweb" -body $iwBody
