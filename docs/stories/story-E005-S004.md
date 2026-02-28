# Upgrade de assentos com pró-rata imediato

**ID:** STORY-E005-S004  
**Epic:** E5 - Planos e assentos de corretores  
**Priority:** Must Have  
**Story Points:** 5  
**Status:** Completed

## User Story
As a **vendedor/admin interno**  
I want to **aumentar assentos e aplicar pró-rata no mesmo ciclo**  
So that **o cliente use capacidade extra imediatamente com cobrança justa**

## Acceptance Criteria
- [ ] Upgrade aumenta `broker_seat_limit` imediatamente.
- [ ] Cálculo pró-rata considera dias restantes no ciclo atual.
- [ ] Valor pró-rata e memória de cálculo ficam registrados.
- [ ] Nova capacidade fica disponível na tela de Equipe sem atraso manual.
- [ ] Evento de upgrade fica auditável por organização.

## Technical Notes
### Implementation Approach
Separar operação de upgrade (efeito imediato) da conciliação financeira (registro de cálculo).

### Files/Modules Affected
- `supabase/migrations/*_broker_seat_proration.sql`
- `src/app/(dashboard)/settings/billing/*`
- `src/app/api/settings/billing/*`

### Data Model Changes
Registro de ajustes de assentos no ciclo atual com metadados de pró-rata.

### API Changes
Endpoint interno de upgrade com retorno de novo limite e resumo financeiro.

### Edge Cases
- Upgrade no último dia de ciclo.
- Múltiplos upgrades no mesmo ciclo.

### Security Considerations
Somente perfil comercial autorizado pode aplicar upgrade.

## Dependencies
- Blocked by: `STORY-E005-S001`  
- Blocks: `STORY-E005-S005`
