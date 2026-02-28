# Downgrade de assentos agendado para próximo ciclo

**ID:** STORY-E005-S005  
**Epic:** E5 - Planos e assentos de corretores  
**Priority:** Must Have  
**Story Points:** 3  
**Status:** Completed

## User Story
As a **vendedor/admin interno**  
I want to **agendar redução de assentos para o próximo ciclo**  
So that **o cliente não perca acesso no meio do período já pago**

## Acceptance Criteria
- [ ] Downgrade não reduz limite no ciclo atual.
- [ ] Solicitação fica marcada com status `scheduled` e data efetiva.
- [ ] Na virada do ciclo, novo limite é aplicado automaticamente.
- [ ] Se brokers ativos > novo limite na virada, aplicação é bloqueada com motivo auditável.
- [ ] Cobrança seguinte reflete o novo limite aplicado.

## Technical Notes
### Implementation Approach
Modelo de alteração futura com validação de capacidade no momento de efetivação.

### Files/Modules Affected
- `supabase/migrations/*_broker_seat_downgrade_schedule.sql`
- `src/app/(dashboard)/settings/billing/*`
- `src/app/api/settings/billing/*`

### Data Model Changes
Fila de alterações de assento com data efetiva e status.

### API Changes
Endpoint para agendar downgrade e consultar pendências.

### Edge Cases
- Cliente agenda downgrade e depois faz upgrade no mesmo ciclo.
- Virada de ciclo com pendência de corretores acima do novo limite.

### Security Considerations
Somente perfil comercial autorizado agenda/aprova downgrade.

## Dependencies
- Blocked by: `STORY-E005-S004`  
- Blocks: `STORY-E005-S007`
