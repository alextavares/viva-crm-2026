# Catálogo comercial de planos por organização com assentos de corretor

**ID:** STORY-E005-S001  
**Epic:** E5 - Planos e assentos de corretores  
**Priority:** Must Have  
**Story Points:** 5  
**Status:** Completed

## User Story
As a **vendedor/admin interno**  
I want to **configurar plano por organização com limite de corretores (broker_seat_limit)**  
So that **eu possa vender pacotes como 1, 5, 10 ou 20 corretores com regra comercial clara**

## Acceptance Criteria
- [ ] Cada organização possui um plano ativo com `broker_seat_limit`.
- [ ] Só usuários com role `broker` entram no cálculo de assentos usados.
- [ ] `owner` e `manager` não consomem assento.
- [ ] O ciclo de cobrança (início/fim) fica registrado por organização.
- [ ] O plano atual (limite e uso) é consultável para telas de Equipe e Cobrança.

## Technical Notes
### Implementation Approach
Criar estrutura de plano por organização, separando contrato comercial de perfis operacionais.

### Files/Modules Affected
- `supabase/migrations/*_broker_seat_plans.sql`
- `src/lib/types.ts`
- `src/app/(dashboard)/settings/*`
- `src/app/api/settings/*`

### Data Model Changes
Nova estrutura de plano/ciclo por organização com campo `broker_seat_limit`.

### API Changes
Leitura do plano atual e metadados de ciclo para consumo interno.

### Edge Cases
- Organização legada sem plano explícito deve receber fallback controlado.
- Mudança de role de `broker` para `assistant` libera assento.

### Security Considerations
Alteração de plano restrita ao perfil administrativo interno.

## Dependencies
- Blocked by: none  
- Blocks: `STORY-E005-S002`, `STORY-E005-S004`
