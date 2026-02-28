# Auditoria e permissões para plano e equipe

**ID:** STORY-E005-S006  
**Epic:** E5 - Planos e assentos de corretores  
**Priority:** Must Have  
**Story Points:** 3  
**Status:** Completed

## User Story
As an **owner/manager e time de suporte**  
I want to **ter trilha de auditoria e permissões claras em equipe/cobrança**  
So that **qualquer mudança de capacidade seja rastreável e segura**

## Acceptance Criteria
- [ ] Eventos de adicionar/remover/reativar broker são registrados.
- [ ] Eventos de upgrade/downgrade são registrados com ator e data.
- [ ] Apenas `owner/manager` altera equipe da organização.
- [ ] Apenas perfil administrativo interno altera limites de plano.
- [ ] Logs permitem explicar bloqueios por limite ou regra de ciclo.

## Technical Notes
### Implementation Approach
Adicionar telemetria de negócio e endurecer autorização por papel e organização.

### Files/Modules Affected
- `supabase/migrations/*_broker_seat_audit.sql`
- `src/app/api/*`
- `src/lib/*`

### Data Model Changes
Eventos de auditoria para mudanças de assento/equipe.

### API Changes
Respostas padronizadas para erro de autorização e bloqueio comercial.

### Edge Cases
- Operação parcial que altera equipe sem evento correspondente.
- Evento duplicado em retry.

### Security Considerations
RLS e regras de autorização obrigatórias para toda escrita.

## Dependencies
- Blocked by: `STORY-E005-S003`  
- Blocks: `STORY-E005-S007`
