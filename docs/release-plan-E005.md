# Release Plan - E5 Planos e Assentos de Corretores

Data: 2026-02-26  
Owner: Produto  
Escopo: `STORY-E005-S001` a `STORY-E005-S008`

## 1. Objetivo do release

Implantar venda por organização com assentos de corretores (`broker`), com:
- hard limit de criação/reativação de `broker`;
- upgrade com pró-rata imediato;
- downgrade no próximo ciclo;
- governança com auditoria e permissões claras.

## 2. Regras de negócio fechadas

- Apenas role `broker` consome assento.
- `owner` e `manager` não consomem assento.
- Bloqueio duro ao atingir o limite.
- Upgrade aplica imediatamente no ciclo atual com pró-rata.
- Downgrade é agendado para próxima virada de ciclo.

## 3. Plano por sprint

### Sprint 5 (2026-03-11 a 2026-03-24)
Histórias:
- `STORY-E005-S001`
- `STORY-E005-S002`
- `STORY-E005-S003`

Critérios de entrada:
- Backlog refinado e estimado.
- Definição de catálogo inicial de planos (ex.: 1/5/10/20).

Critérios de saída:
- Plano por organização ativo com `broker_seat_limit`.
- Bloqueio backend de create/reactivate acima do limite funcionando.
- Tela Equipe com contador `usados/limite` e CTA de upgrade.

Go/No-Go:
- **Go** se bloqueio for garantido no backend e sem regressão em gestão de usuários.
- **No-Go** se validação existir apenas na UI.

### Sprint 6 (2026-03-25 a 2026-04-07)
Histórias:
- `STORY-E005-S004`
- `STORY-E005-S005`

Critérios de entrada:
- Dados de ciclo de cobrança disponíveis por organização.
- Regra de arredondamento pró-rata definida.

Critérios de saída:
- Upgrade com efeito imediato e registro de cálculo pró-rata.
- Downgrade com status agendado para próximo ciclo.
- Validação de virada: não reduzir abaixo de brokers ativos.

Go/No-Go:
- **Go** se upgrade/downgrade estiverem auditáveis e consistentes em ciclo.
- **No-Go** se houver risco de perda de acesso no meio do ciclo.

### Sprint 7 (2026-04-08 a 2026-04-21)
Histórias:
- `STORY-E005-S006`
- `STORY-E005-S007`

Critérios de entrada:
- Eventos de auditoria definidos.
- Lista de organizações legadas para migração validada.

Critérios de saída:
- Auditoria de alterações de equipe e plano ativa.
- Permissões hardenizadas por role.
- Migração concluída em ambiente controlado + piloto com 3-5 clientes.

Go/No-Go:
- **Go** se piloto não tiver incidente P0/P1.
- **No-Go** se suporte não conseguir explicar bloqueios/eventos com logs.

### Sprint 8 (2026-04-22 a 2026-05-05)
História:
- `STORY-E005-S008`

Critérios de entrada:
- Dados de uso/limite já confiáveis em produção.

Critérios de saída:
- Alertas de capacidade próximos ao limite ativos.
- CTA de upgrade em contexto de Equipe/Cobrança.

Go/No-Go:
- **Go** se alertas reduzirem bloqueio surpresa sem gerar ruído excessivo.
- **No-Go** se alerta causar confusão operacional.

## 4. Estratégia de rollout

1. Ativar por feature flag interna para equipe comercial/suporte.  
2. Migrar organizações legadas em lote controlado.  
3. Rodar piloto com 3-5 clientes reais.  
4. Expandir gradualmente por coortes até 100% da base.

## 5. Métricas de sucesso (release)

- Taxa de bloqueio por limite de assento.
- Tempo médio entre bloqueio e upgrade aplicado.
- % upgrades no mesmo ciclo após bloqueio.
- Tickets de suporte relacionados a seats/cobrança por cliente ativo.

## 6. Riscos e mitigação

- Risco: divergência entre assentos usados e limite.  
Mitigação: validação única no backend + auditoria.

- Risco: cálculo pró-rata inconsistente.  
Mitigação: fórmula única com registro de memória de cálculo.

- Risco: downgrade quebrar operação.  
Mitigação: aplicar só na virada e bloquear abaixo de brokers ativos.

## 7. Plano de rollback

- Manter fallback temporário de limite atual por organização.
- Em incidente crítico, pausar alterações comerciais novas (upgrade/downgrade).
- Preservar acesso de usuários já ativos até correção.
- Reprocessar ajustes comerciais com trilha de auditoria após estabilização.

## 8. Checklist final de readiness

- [ ] QA funcional de Equipe/Cobrança aprovado.
- [ ] Logs e auditoria consultáveis pelo suporte.
- [ ] Playbook comercial para upgrade/downgrade documentado.
- [ ] Migração legada validada em staging.
- [ ] Piloto aprovado com decisão formal de Go-Live.

