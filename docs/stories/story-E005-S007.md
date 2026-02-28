# Migração da base atual e piloto de rollout

**ID:** STORY-E005-S007  
**Epic:** E5 - Planos e assentos de corretores  
**Priority:** Should Have  
**Story Points:** 5  
**Status:** Completed

## User Story
As an **operação do produto**  
I want to **migrar clientes atuais para o novo modelo e validar com piloto**  
So that **a transição ocorra sem quebra de acesso e com risco controlado**

## Acceptance Criteria
- [x] Todas as organizações existentes recebem plano inicial definido.
- [x] Migração preserva usuários e permissões atuais sem regressão.
- [x] Piloto com 3-5 clientes é executado antes do rollout total.
- [x] Métricas mínimas do piloto são coletadas (bloqueios, upgrades, tickets).
- [x] Checklist de go/no-go documenta decisão de expansão.

## Technical Notes
### Implementation Approach
Executar rollout gradual com fallback operacional e monitoramento.

### Files/Modules Affected
- `scripts/*`
- `docs/*`
- `supabase/migrations/*`

### Data Model Changes
Backfill de contrato/plano para organizações legadas.

### API Changes
Sem mudanças obrigatórias de API pública; foco em operação e migração.

### Edge Cases
- Organização com mais brokers ativos do que limite inicial migrado.
- Dados legados incompletos para ciclo comercial.

### Security Considerations
Processo de migração deve respeitar escopo por organização e trilha de auditoria.

## Dependencies
- Blocked by: `STORY-E005-S005`, `STORY-E005-S006`  
- Blocks: `STORY-E005-S008`
