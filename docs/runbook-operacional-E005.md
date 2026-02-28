# Runbook Operacional - E5 Planos e Assentos de Corretores

Data: 2026-02-26  
Escopo: Operação diária e incidentes do modelo de assentos `broker`

## 1. Objetivo

Padronizar a operação de planos por organização com limite de corretores, garantindo execução consistente entre comercial, suporte e operação técnica.

## 2. Regras de negócio (fonte única)

- Plano por organização com `broker_seat_limit`.
- Só role `broker` consome assento.
- `owner` e `manager` não consomem assento.
- Hard limit para criação/reativação de `broker`.
- Upgrade com efeito imediato + pró-rata no ciclo atual.
- Downgrade agendado para o próximo ciclo.

## 3. Papéis e responsabilidades

- Comercial:
  - define pacote de assentos;
  - aprova upgrade/downgrade;
  - comunica impacto financeiro ao cliente.
- Suporte:
  - atende bloqueios por limite;
  - executa troubleshooting de fluxo operacional;
  - coleta evidências de incidentes.
- Operação técnica:
  - monitora auditoria/eventos;
  - acompanha jobs de aplicação de ciclo;
  - conduz rollback operacional quando necessário.

## 4. Procedimentos operacionais padrão (SOP)

### 4.1 Onboarding de cliente novo
1. Criar organização e associar plano inicial.
2. Definir `broker_seat_limit` contratado.
3. Validar contador `usados/limite` na Equipe.
4. Confirmar regra de bloqueio ativa para `broker`.
5. Registrar início do ciclo de cobrança.

Saída esperada:
- cliente ativo com capacidade correta;
- trilha de auditoria inicial criada.

### 4.2 Upgrade de assentos
1. Receber solicitação com novo limite desejado.
2. Validar limite atual e uso atual.
3. Calcular pró-rata do período restante.
4. Aplicar upgrade imediatamente.
5. Confirmar liberação de novos brokers na Equipe.
6. Registrar operação e cálculo no histórico.

SLA recomendado:
- até 30 min em horário comercial.

### 4.3 Downgrade de assentos
1. Receber solicitação e validar novo limite.
2. Comparar brokers ativos vs novo limite.
3. Agendar downgrade para próximo ciclo.
4. Comunicar data efetiva ao cliente.
5. Na virada, aplicar downgrade se condição de capacidade for válida.

Regra crítica:
- nunca reduzir no meio do ciclo vigente.

### 4.4 Atendimento de bloqueio por limite
1. Confirmar `usados/limite` da organização.
2. Confirmar tentativa de create/reactivate `broker`.
3. Oferecer opções:
   - desativar broker inativo;
   - upgrade imediato.
4. Executar opção escolhida.
5. Confirmar retorno operacional com cliente.

## 5. Monitoramento e alertas

- Indicadores diários:
  - bloqueios por limite;
  - upgrades aplicados;
  - downgrades agendados;
  - tempo médio de atendimento de bloqueio.
- Alertas de atenção:
  - aumento abrupto de bloqueios por limite;
  - falha em aplicação de mudança de ciclo;
  - inconsistência entre assentos usados e limite.

## 6. Tratamento de incidentes

### 6.1 Classificação
- P0: perda de acesso generalizada ou alteração indevida de limites.
- P1: falha de upgrade/downgrade impactando cliente ativo.
- P2: erro de mensagem/UX sem quebra de regra de negócio.

### 6.2 Fluxo de resposta
1. Abrir incidente com timestamp, organização e impacto.
2. Congelar novas alterações comerciais se houver risco sistêmico.
3. Levantar eventos de auditoria relacionados.
4. Aplicar contenção temporária.
5. Comunicar status ao cliente afetado.
6. Executar correção definitiva e validar.
7. Encerrar com post-mortem curto.

## 7. Plano de rollback operacional

Aplicar rollback quando houver risco de impacto em cadeia.

Passos:
1. Pausar upgrades/downgrades novos.
2. Preservar acesso dos brokers já ativos.
3. Reverter apenas alterações comerciais recentes com evidência auditável.
4. Revalidar contador `usados/limite` por organização impactada.
5. Retomar operação gradualmente após validação QA.

## 8. Checklist diário de operação

- [ ] Verificar incidentes abertos de seats/cobrança.
- [ ] Revisar bloqueios por limite acima do baseline.
- [ ] Conferir upgrades pendentes de execução manual.
- [ ] Conferir downgrades com virada próxima.
- [ ] Validar integridade básica de auditoria/eventos.

## 9. Checklist de fechamento de ciclo

- [ ] Processar downgrades agendados.
- [ ] Validar condição `brokers_ativos <= novo_limite` antes de aplicar.
- [ ] Registrar downgrades aplicados e bloqueados.
- [ ] Atualizar relatório de KPIs comerciais do ciclo.

## 10. Comunicação padrão com cliente

- Bloqueio por limite:
  - “Seu plano atingiu o limite de corretores ativos. Posso te ajudar a liberar assento desativando um corretor inativo ou aplicar upgrade imediato com pró-rata.”
- Upgrade aplicado:
  - “Upgrade confirmado. Seu novo limite de corretores já está ativo e disponível no CRM.”
- Downgrade agendado:
  - “Downgrade registrado e programado para o próximo ciclo, sem impacto no seu acesso atual.”

