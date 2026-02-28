# Hard limit de corretores na gestão de equipe

**ID:** STORY-E005-S002  
**Epic:** E5 - Planos e assentos de corretores  
**Priority:** Must Have  
**Story Points:** 5  
**Status:** Completed

## User Story
As an **owner/manager**  
I want to **adicionar ou reativar corretor somente até o limite contratado**  
So that **a operação respeite o plano sem exceções manuais**

## Acceptance Criteria
- [ ] Ao tentar criar `broker` acima do limite, a ação é bloqueada.
- [ ] Ao tentar reativar `broker` acima do limite, a ação é bloqueada.
- [ ] A regra de bloqueio existe no backend, não apenas na UI.
- [ ] Mensagem de erro informa limite atual e orienta upgrade.
- [ ] Fluxos de criação/edição de `owner/manager` continuam sem consumo de assento.

## Technical Notes
### Implementation Approach
Centralizar a validação de capacidade em uma regra única reutilizável para create/reactivate.

### Files/Modules Affected
- `supabase/migrations/*_broker_seat_enforcement.sql`
- `src/app/(dashboard)/settings/*`
- `src/app/api/*`

### Data Model Changes
Sem nova entidade obrigatória além da estrutura base de plano; foco em validação de regra.

### API Changes
Respostas de erro padronizadas para bloqueio comercial por limite.

### Edge Cases
- Concorrência em criação simultânea de dois brokers.
- Broker inativo não pode ser contado como assento em uso.

### Security Considerations
Respeitar isolamento por organização e permissões de role.

## Dependencies
- Blocked by: `STORY-E005-S001`  
- Blocks: `STORY-E005-S003`
