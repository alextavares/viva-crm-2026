# Pricing add-on WhatsApp por organização

**ID:** STORY-E003-S001  
**Epic:** E3 - Conversão via site público e WhatsApp  
**Priority:** Must Have  
**Story Points:** 5  
**Status:** Completed

## User Story
As an **owner/manager**  
I want to **definir um plano de add-on WhatsApp separado do CRM base**  
So that **eu possa cobrar de forma clara sem forçar custo extra para todos os clientes**

## Acceptance Criteria
- [ ] Existe configuração de add-on WhatsApp separada do plano base.
- [ ] Add-on pode ser habilitado/desabilitado por organização.
- [ ] Plano define quota mensal inclusa (mensagens/conversas).
- [ ] Excedente por unidade é configurável (valor numérico).
- [ ] Dashboard de configuração exibe estado atual do add-on de forma clara.

## Technical Notes
### Implementation Approach
Adicionar estrutura de pricing por tenant e API de leitura/escrita protegida para owner/manager.

### Files/Modules Affected
- `supabase/migrations/*_whatsapp_addon_pricing.sql`
- `src/app/(dashboard)/settings/*`
- `src/app/api/settings/*`
- `src/lib/types.ts`

### Data Model Changes
Nova tabela para billing config do add-on WhatsApp por organização.

### API Changes
Endpoint seguro para salvar/ler pricing add-on.

### Edge Cases
- Organização sem add-on deve operar normalmente no CRM base.
- Valores inválidos (negativos) devem ser rejeitados.
- Alterações não podem quebrar tenants existentes.

### Security Considerations
Somente `owner/manager` pode alterar pricing.

## Dependencies
- Blocked by: none  
- Blocks: `STORY-E003-S002`
