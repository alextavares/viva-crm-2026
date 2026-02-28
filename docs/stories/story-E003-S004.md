# Regras de bloqueio/envio por plano de WhatsApp

**ID:** STORY-E003-S004  
**Epic:** E3 - Conversão via site público e WhatsApp  
**Priority:** Must Have  
**Story Points:** 3  
**Status:** Completed

## User Story
As an **owner/manager**  
I want to **aplicar regras de envio conforme plano/quota**  
So that **o sistema não gere custo fora da política comercial**

## Acceptance Criteria
- [x] Quando add-on está desativado, envio oficial não dispara.
- [x] Quando quota mensal acabou, sistema bloqueia envio oficial e registra evento.
- [x] Mensagem de bloqueio é clara no CRM (sem erro técnico cru).
- [x] Fluxos existentes sem WhatsApp oficial continuam funcionando.
- [x] Logs de auditoria permitem entender por que um envio foi bloqueado.

## Technical Notes
### Implementation Approach
Inserir camada de policy-check antes de qualquer dispatch oficial.

### Files/Modules Affected
- `supabase/migrations/20260225013000_whatsapp_send_policy.sql`
- `src/components/followups/followup-settings-form.tsx`

### Data Model Changes
Eventos de bloqueio e motivo em tabela de eventos/mensagens ou tabela específica de audit.

### API Changes
Respostas de API devem distinguir bloqueio comercial de falha técnica.

## Implementation Notes
- Criada função `public.whatsapp_send_policy_check(...)` para decisão comercial de envio oficial por tenant (add-on/quota/período).
- `public.followup_process_due(...)` agora:
  - usa canal `whatsapp_official` apenas quando canal está conectado e policy permite;
  - bloqueia envio oficial por regra comercial com fallback em `followup_auto`;
  - registra auditoria em `contact_events` com tipo `whatsapp_policy_blocked`;
  - grava mensagem clara em `followup_jobs.error` para leitura no CRM;
  - retorna métricas `blocked` e `official_sent` no payload.

### Edge Cases
- Quota negativa não pode ocorrer.
- Retries não devem atravessar bloqueio de quota.
- Mudança de plano deve refletir imediatamente.

### Security Considerations
Sem exposição de dados sensíveis do provedor.

## Dependencies
- Blocked by: `STORY-E003-S003`  
- Blocks: none
