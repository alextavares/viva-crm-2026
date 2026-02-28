# Alertas comerciais de capacidade e pré-upgrade

**ID:** STORY-E005-S008  
**Epic:** E5 - Planos e assentos de corretores  
**Priority:** Could Have  
**Story Points:** 2  
**Status:** Completed

## User Story
As an **owner/manager**  
I want to **receber alertas quando estiver perto do limite de assentos**  
So that **eu consiga pedir upgrade antes de bloquear a operação**

## Acceptance Criteria
- [x] Sistema alerta quando faltarem poucos assentos (ex.: 1 restante).
- [x] Alerta aparece em contexto de Equipe e Cobrança.
- [x] Alerta inclui ação rápida de solicitar upgrade.
- [x] Alerta não aparece para organizações abaixo do limiar.

## Technical Notes
### Implementation Approach
Usar sinalização simples de capacidade para reduzir bloqueios surpresa.

### Files/Modules Affected
- `src/app/(dashboard)/settings/*`
- `src/components/*`

### Data Model Changes
Sem mudanças estruturais obrigatórias.

### API Changes
Aproveitar dados já disponíveis de uso/limite.

### Edge Cases
- Oscilação de estado quando equipe muda rapidamente.
- Evitar notificação repetitiva em todas as páginas.

### Security Considerations
Somente usuários autorizados visualizam dados de capacidade da organização.

## Dependencies
- Blocked by: `STORY-E005-S007`  
- Blocks: none
