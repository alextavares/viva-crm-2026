# Tela Equipe com contador de assentos e CTA de upgrade

**ID:** STORY-E005-S003  
**Epic:** E5 - Planos e assentos de corretores  
**Priority:** Must Have  
**Story Points:** 3  
**Status:** Completed

## User Story
As an **owner/manager**  
I want to **ver assentos usados/limite e ação de upgrade na tela de Equipe**  
So that **eu entenda capacidade atual antes de contratar mais corretores**

## Acceptance Criteria
- [ ] Tela exibe contador no formato `usados/limite`.
- [ ] Exibe alerta quando faltar 1 assento para atingir o limite.
- [ ] Em limite atingido, CTA de upgrade fica visível e claro.
- [ ] UI diferencia corretor ativo (consome) de corretor inativo (não consome).
- [ ] Ações bloqueadas mostram feedback amigável (sem erro técnico cru).

## Technical Notes
### Implementation Approach
Evoluir o card "Equipe" de placeholder para módulo operacional mínimo.

### Files/Modules Affected
- `src/app/(dashboard)/settings/page.tsx`
- `src/app/(dashboard)/settings/team/*`
- `src/components/*`

### Data Model Changes
Sem mudanças estruturais adicionais.

### API Changes
Consulta consolidada de plano + uso de assentos para renderização da tela.

### Edge Cases
- Organização sem corretores ainda deve mostrar `0/limite`.
- Carregamento parcial não pode esconder bloqueio de capacidade.

### Security Considerations
Apenas `owner/manager` pode gerenciar equipe.

## Dependencies
- Blocked by: `STORY-E005-S002`  
- Blocks: `STORY-E005-S006`
