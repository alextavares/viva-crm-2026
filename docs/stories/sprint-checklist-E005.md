# Sprint Checklist - E5 Planos e Assentos de Corretores

## Sprint 1 - Fundação comercial e limite operacional
- [x] `STORY-E005-S001` Catálogo comercial de planos por organização com assentos de corretor
- [x] `STORY-E005-S002` Hard limit de corretores na gestão de equipe
- [x] `STORY-E005-S003` Tela Equipe com contador de assentos e CTA de upgrade

## Sprint 2 - Cobrança no ciclo atual
- [x] `STORY-E005-S004` Upgrade de assentos com pró-rata imediato
- [x] `STORY-E005-S005` Downgrade de assentos agendado para próximo ciclo

## Sprint 3 - Governança e rollout seguro
- [x] `STORY-E005-S006` Auditoria e permissões para plano e equipe
- [x] `STORY-E005-S007` Migração da base atual e piloto de rollout

## Sprint 4 - Otimização comercial
- [x] `STORY-E005-S008` Alertas comerciais de capacidade e pré-upgrade

## Regras de negócio consolidadas
- [x] Apenas role `broker` consome assento.
- [x] `owner` e `manager` não consomem assento.
- [x] Bloqueio duro para novo `broker` acima do limite.
- [x] Upgrade com pró-rata imediato.
- [x] Downgrade aplicado apenas no próximo ciclo.
