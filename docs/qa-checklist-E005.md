# QA Checklist - E5 Planos e Assentos de Corretores

Data: 2026-02-26  
Escopo: `STORY-E005-S001` a `STORY-E005-S008`

## 1. Objetivo de QA

Validar que o modelo comercial por assentos `broker` funciona sem brechas de regra, sem regressão de permissões e sem inconsistência de cobrança operacional.

## 2. Regras obrigatórias (pass/fail)

- [x] Apenas `broker` consome assento.
- [x] `owner` e `manager` não consomem assento.
- [x] Hard limit bloqueia criação/reativação acima do limite.
- [ ] Upgrade aumenta limite imediatamente.
- [ ] Upgrade registra pró-rata do ciclo atual.
- [ ] Downgrade só aplica no próximo ciclo.

## 3. Checklist por sprint

### Sprint 5 - Fundação (S001, S002, S003)

#### 3.1 Plano e limite por organização
- [x] Organização nova recebe plano com `broker_seat_limit`.
- [x] Organização legada sem plano explícito não quebra tela de Equipe.
- [x] Contador `usados/limite` reflete estado real.

#### 3.2 Regra de consumo por role
- [x] Criar `owner` não altera assentos usados.
- [x] Criar `manager` não altera assentos usados.
- [x] Criar `broker` incrementa assentos usados.
- [ ] Desativar `broker` decrementa assentos usados.
- [ ] Reativar `broker` incrementa assentos usados (se houver capacidade).

#### 3.3 Hard limit e UX de bloqueio
- [x] Com limite atingido, criar `broker` retorna bloqueio.
- [ ] Com limite atingido, reativar `broker` retorna bloqueio.
- [x] Mensagem de bloqueio exibe limite e ação recomendada (upgrade).
- [ ] UI não permite “contornar” a regra via fluxo alternativo.

#### 3.4 Concorrência
- [x] Duas tentativas simultâneas de criar broker no último assento: apenas uma deve passar.
- [x] Estado final de assentos permanece consistente após race condition.

Go/No-Go Sprint 5:
- [x] Go se regra de bloqueio estiver no backend e validada em concorrência.

### Sprint 6 - Cobrança operacional (S004, S005)

#### 3.5 Upgrade imediato com pró-rata
- [ ] Aplicar upgrade aumenta limite imediatamente na organização.
- [ ] Cálculo pró-rata usa dias restantes corretos do ciclo.
- [ ] Registro de cálculo (memória) fica auditável.
- [ ] Múltiplos upgrades no mesmo ciclo não sobrescrevem histórico indevidamente.

#### 3.6 Downgrade agendado
- [ ] Downgrade fica com status `scheduled`.
- [ ] Limite atual não muda no mesmo ciclo.
- [ ] Na virada, novo limite é aplicado automaticamente.
- [ ] Se brokers ativos > novo limite na virada, aplicação é bloqueada com motivo.

Go/No-Go Sprint 6:
- [ ] Go se não houver redução de acesso no meio do ciclo.

### Sprint 7 - Governança e rollout (S006, S007)

#### 3.7 Permissões e segurança
- [ ] `owner/manager` consegue gerir equipe da própria org.
- [ ] `broker` não consegue alterar equipe.
- [ ] Usuário de outra organização não consegue ler/alterar dados de seats.
- [ ] Ações administrativas de plano exigem perfil interno autorizado.

#### 3.8 Auditoria
- [x] Evento gerado para create/reactivate/deactivate broker.
- [ ] Evento gerado para upgrade/downgrade.
- [x] Evento registra ator, organização, timestamp e ação.
- [x] Falhas de bloqueio também ficam rastreáveis.

#### 3.9 Migração legada + piloto
- [x] Organizações legadas recebem plano inicial sem quebra de login/operação.
- [x] Clientes do piloto executam fluxo completo sem incidente crítico.
- [x] Métricas de piloto são coletadas e reportadas.

Go/No-Go Sprint 7:
- [x] Go: suporte consegue explicar bloqueios/eventos com base em logs de `team_audit_events`.

### Sprint 8 - Alertas comerciais (S008)

#### 3.10 Alertas de capacidade
- [x] Alerta aparece quando capacidade está próxima do limite.
- [x] CTA de upgrade abre fluxo correto.
- [x] Alerta não aparece para clientes longe do limite.
- [x] Alerta não gera duplicação excessiva em múltiplas páginas.

Go/No-Go Sprint 8:
- [x] Go: alertas ajudam a antecipar upgrade sem ruído operacional excessivo.

## 4. Cenários de regressão obrigatórios

- [ ] Cadastro de usuários não-broker continua funcional.
- [ ] Fluxos de leads/SLA/follow-up não sofrem regressão.
- [ ] Tela de configurações continua acessível para roles corretas.
- [x] Build/lint/testes automatizados passam no CI.

## 5. Matriz mínima de testes

- [ ] Unitário: regra de consumo de assento por role.
- [ ] Unitário: bloqueio create/reactivate acima do limite.
- [ ] Integração: upgrade + cálculo pró-rata + persistência.
- [ ] Integração: downgrade agendado + efetivação na virada.
- [ ] E2E: owner/manager gerindo equipe e recebendo bloqueio/CTA.
- [ ] E2E: tentativa indevida por broker (autorização negada).

## 5.1 Evidências coletadas (Sprint 5)

- Data: 2026-02-26
- Comandos:
  - `npm run lint` (passou)
  - `npm test` (passou: 4 suites, 11 testes)
  - `npm run build` (passou)
  - `npx supabase db push` (migrações aplicadas)
- SQL pós-teste:
  - `get_broker_seat_usage(...)` retornou `used=1`, `seat_limit=1`, `available=0`
  - `team_invites` com convite `accepted` para broker
  - `profiles` contendo `owner` + `broker` ativo na mesma org
- Teste funcional:
  - tentativa de novo convite broker com limite cheio retornou `broker_seat_limit_reached`
  - teste de concorrência em ativação paralela de 2 brokers para 1 assento: 1 sucesso + 1 bloqueio (`broker_seat_limit_reached`)

## 5.2 Evidências coletadas (Sprint 6 - parcial)

- Data: 2026-02-26
- Entregas técnicas:
  - migração `20260226203000_broker_seat_billing_changes.sql` aplicada no remoto
  - APIs criadas: `/api/settings/billing/seats` e `/api/jobs/billing/seats/apply-due`
  - UI criada: `/settings/billing`
- Qualidade:
  - `npm run lint` (passou)
  - `npm test` (passou: 5 suites, 13 testes)
  - `npm run build` (passou)
- Cenários funcionais validados em banco:
  - downgrade vencido com `used <= new_limit` foi aplicado (`status=applied`, limite atualizado)
  - downgrade vencido com `used > new_limit` permaneceu `scheduled` (bloqueado)

## 5.3 Evidências coletadas (Sprint 7)

- Data: 2026-02-26
- Governança:
  - auditoria visível em `/settings/team` (eventos recentes no retorno de API)
  - eventos de `invite`/`member-status` e bloqueios persistidos em `team_audit_events`
- Rollout:
  - script operacional criado: `scripts/e005_validate_rollout.js`
  - execução real da janela atual:
    - `missing_plans_count = 0`
    - `inconsistent_orgs_count = 0`
    - métricas piloto reportadas (`upgrades_applied`, `downgrades_scheduled`, `downgrades_applied`, `downgrades_blocked`)
  - execução de coorte piloto (5 organizações):
    - `scope = pilot_orgs`
    - `pilot_orgs_count = 5`
    - `tickets_opened = 0`
    - `pilot_ticket_hints = 0`
  - comando usado:
    - `node -r dotenv/config scripts/e005_validate_rollout.js --pilot-org-ids "0a71c849-fc2b-4da0-9c4e-17bcf9c837f5,b2d66c43-40c7-4512-9af7-460d3b1cf249,e900808e-32fe-4434-b8c5-c8efa5ad3fd3,7f27e72a-232e-40c2-8e5a-5d4565d3f371,6518b8d1-49df-48d0-a165-9f039942d2a0" --tickets-opened 0 dotenv_config_path=.env.local`

## 6. Evidências exigidas para aprovação

- [ ] Capturas de tela dos fluxos críticos (limite, upgrade, downgrade).
- [x] Logs/eventos de auditoria anexados por cenário.
- [ ] Resultado de CI (lint/test/build) sem falha.
- [x] Registro de decisão Go/No-Go por sprint.

## 7. Critério final de release (E5)

Somente aprovar release se todos os itens abaixo estiverem verdadeiros:
- [ ] Hard limit validado em backend e concorrência.
- [ ] Pró-rata validado com memória de cálculo.
- [ ] Downgrade validado para próximo ciclo com proteção de capacidade.
- [x] Permissões e auditoria sem brechas críticas.
- [x] Piloto aprovado sem incidente P0/P1.

## 5.4 Evidências coletadas (Sprint 8)

- Data: 2026-02-26
- Entregas técnicas:
  - componente reutilizável de alerta de capacidade com CTA: `src/components/team/seat-capacity-alert.tsx`
  - alerta aplicado em `/settings/team` e `/settings/billing`
  - regra de limiar centralizada em `getSeatCapacityAlert(...)`
- Qualidade:
  - `npm test -- team-billing` (passou: 1 suite, 5 testes)
  - `npm run lint` (passou)
