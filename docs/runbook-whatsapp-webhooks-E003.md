# Runbook Operacional - Webhooks Inbound WhatsApp (E3-S006)

Data: 2026-02-26  
Escopo: operação do endpoint `GET/POST /api/webhooks/whatsapp/[token]`

## 1. Objetivo

Padronizar configuração, validação, troubleshooting e rotação de token para ingestão inbound WhatsApp (Meta/Twilio) no CRM.

## 2. Pré-requisitos

- Endpoint disponível em ambiente alvo:
  - `GET /api/webhooks/whatsapp/{token}`
  - `POST /api/webhooks/whatsapp/{token}`
- Estruturas de banco ativas:
  - `public.webhook_endpoints`
  - `public.webhook_ingest_lead(...)`
  - `public.webhook_create_endpoint(...)`
- Token ativo em `webhook_endpoints` para `source` apropriado (`portal_zap`, `portal_olx`, etc.).

## 3. Contrato operacional

- `GET`:
  - uso: validação de webhook estilo Meta;
  - sucesso: `hub.mode=subscribe`, `hub.verify_token == {token}`, retorna `hub.challenge`.
- `POST`:
  - aceita payload de `meta` ou `twilio`;
  - `?provider=meta|twilio` é opcional (há autodetecção);
  - resposta esperada:
    - `{ ok: true, received, ingested, skipped, contacts }`.

## 4. Smoke test (cURL)

### 4.1 Verificação Meta (GET challenge)

```bash
curl -i "https://SEU_DOMINIO/api/webhooks/whatsapp/TOKEN?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=12345"
```

Esperado:
- HTTP `200`
- body: `12345`

### 4.2 Inbound Meta (POST)

```bash
curl -i -X POST "https://SEU_DOMINIO/api/webhooks/whatsapp/TOKEN?provider=meta" \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "contacts": [{ "profile": { "name": "Lead Meta" } }],
          "messages": [{
            "id": "wamid.demo.001",
            "from": "5511999990001",
            "type": "text",
            "text": { "body": "Olá, quero saber mais." }
          }]
        }
      }]
    }]
  }'
```

Esperado:
- HTTP `200`
- `ingested >= 1`

### 4.3 Inbound Twilio (POST)

```bash
curl -i -X POST "https://SEU_DOMINIO/api/webhooks/whatsapp/TOKEN?provider=twilio" \
  -H "Content-Type: application/json" \
  -d '{
    "From": "whatsapp:+5511999990002",
    "ProfileName": "Lead Twilio",
    "Body": "Tenho interesse no imóvel.",
    "MessageSid": "SM-DEMO-001"
  }'
```

Esperado:
- HTTP `200`
- `ingested >= 1`

## 5. Troubleshooting rápido

- `403` no `GET` de verificação:
  - `hub.verify_token` divergente do token da rota.
- `404` no `POST`:
  - token não existe ou está inativo em `webhook_endpoints`.
- `200` com `ingested=0`:
  - payload sem mensagem inbound útil (ex.: status-only da Meta).
- `500` no `POST`:
  - verificar existência das funções/tabelas (`webhook_ingest_lead`, `webhook_endpoints`) e logs da API.

Consultas úteis:

```sql
select id, organization_id, source, is_active, created_at
from public.webhook_endpoints
where token = 'TOKEN';
```

```sql
select id, type, source, payload, created_at
from public.contact_events
where created_at > now() - interval '30 minutes'
order by created_at desc;
```

```sql
select id, direction, channel, body, created_at
from public.messages
where created_at > now() - interval '30 minutes'
order by created_at desc;
```

## 6. Rotação de token (sem downtime)

1. Criar novo token ativo para mesma organização/source.
2. Atualizar provedor (Meta/Twilio) para usar novo endpoint.
3. Executar smoke test `GET/POST` no novo token.
4. Desativar token antigo (`is_active=false`).
5. Registrar operação (quem, quando, motivo).

Checklist:
- [ ] Novo token criado e testado
- [ ] Provedor apontando para novo token
- [ ] Token antigo desativado
- [ ] Evidência do teste anexada

## 7. Evidência padrão para mudança

- Ambiente
- Organização
- Source
- Token novo (mascarado)
- Timestamp de validação
- Resultado `received/ingested/skipped`

