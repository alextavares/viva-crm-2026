# Medição de consumo do add-on WhatsApp

**ID:** STORY-E003-S003  
**Epic:** E3 - Conversão via site público e WhatsApp  
**Priority:** Should Have  
**Story Points:** 3  
**Status:** Completed

## User Story
As an **owner/manager**  
I want to **ver o consumo do add-on em tempo real simples**  
So that **eu consiga prever custo e evitar bloqueio inesperado**

## Acceptance Criteria
- [x] Sistema registra uso por organização para eventos de envio.
- [x] Painel mostra: quota inclusa, consumido no período e saldo.
- [x] Exibe alerta visual quando atingir 80% e 100% da quota.
- [x] Reset de período mensal é consistente (timezone definido).
- [x] Consulta do consumo responde rápido no dashboard (<1s percepção).

## Technical Notes
### Implementation Approach
Contador incremental por tenant com leitura agregada simples para dashboard.

### Files/Modules Affected
- `supabase/migrations/*_whatsapp_usage.sql`
- `src/app/(dashboard)/settings/*`
- `src/app/api/settings/*`
- `src/lib/types.ts`

### Data Model Changes
Tabela de uso mensal por organização + função de incremento idempotente por evento.

### API Changes
RPC/endpoint para snapshot de consumo.

### Edge Cases
- Reprocessamento não pode duplicar consumo.
- Período sem uso deve retornar zero, não erro.
- Tenant sem add-on deve retornar estado neutro.

### Security Considerations
Somente dados da própria organização.

## Dependencies
- Blocked by: `STORY-E003-S002`  
- Blocks: `STORY-E003-S004`
