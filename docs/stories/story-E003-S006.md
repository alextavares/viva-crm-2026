# Normalização de webhooks inbound de provedores WhatsApp

**ID:** STORY-E003-S006  
**Epic:** E3 - Conversão via site público e WhatsApp  
**Priority:** Should Have  
**Story Points:** 5  
**Status:** Completed

## User Story
As an **operação/comercial**  
I want to **receber webhooks inbound de diferentes provedores WhatsApp em um formato único**  
So that **os leads cheguem no CRM sem depender de parser específico por provedor em cada fluxo**

## Acceptance Criteria
- [x] Endpoint de webhook inbound aceita payloads de ao menos Meta e Twilio.
- [x] Payloads são normalizados para um contrato único de ingestão.
- [x] Eventos sem mensagem inbound útil (ex.: status-only) não quebram o endpoint.
- [x] Ingestão reaproveita pipeline tokenizado existente (`webhook_ingest_lead`).
- [x] Cobertura mínima de testes para normalização é adicionada.

## Technical Notes
### Implementation Approach
Criar camada de normalização por provedor e concentrar ingestão via RPC pública existente.

### Files/Modules Affected
- `src/lib/whatsapp-webhook-normalizer.ts`
- `src/app/api/webhooks/whatsapp/[token]/route.ts`
- `src/__tests__/whatsapp-webhook-normalizer.test.ts`

### Data Model Changes
Sem mudança estrutural no banco; reutiliza `webhook_endpoints`, `contact_events` e `messages`.

### API Changes
- Novo endpoint `GET/POST /api/webhooks/whatsapp/[token]`.
- `GET` suporta verificação de webhook estilo Meta (`hub.mode`, `hub.verify_token`, `hub.challenge`).
- `POST` aceita `?provider=meta|twilio` (opcional, com autodetecção).

### Edge Cases
- Webhook apenas com `statuses` (sem `messages`) retorna sucesso com `ingested=0`.
- Payload de mídia Twilio sem body textual gera mensagem padrão para não perder contexto.

### Security Considerations
Token de rota continua como segredo operacional; ingestão efetiva depende de token ativo validado no RPC.

## Dependencies
- Blocked by: `STORY-E003-S002`, `STORY-E003-S004`  
- Blocks: none

## Evidence
- Migration aplicada no ambiente remoto para habilitar `webhook_endpoints`, `webhook_ingest_lead` e `webhook_create_endpoint`.
- Script de validação operacional: `node -r dotenv/config scripts/e003_validate_whatsapp_webhook_ingest.js dotenv_config_path=.env.local`
- Resultado da última execução:
  - `ingested_count = 2`
  - `lead_events_found = 2`
  - `inbound_messages_found = 2`
- Runbook operacional: `docs/runbook-whatsapp-webhooks-E003.md`
