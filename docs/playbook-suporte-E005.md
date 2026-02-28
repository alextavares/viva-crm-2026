# Playbook de Suporte - E5 Planos e Assentos de Corretores

Data: 2026-02-26  
Escopo: atendimento de tickets relacionados a limite de `broker`, upgrade, downgrade e ciclo

## 1. Objetivo

Padronizar o suporte para resolver rapidamente dúvidas e bloqueios de assentos, com respostas consistentes e escalonamento correto.

## 2. Regras que o suporte deve seguir

- Só role `broker` consome assento.
- `owner` e `manager` não consomem assento.
- Bloqueio de criação/reativação de `broker` acima do limite é comportamento esperado.
- Upgrade libera na hora com pró-rata.
- Downgrade entra apenas no próximo ciclo.

## 3. Classificação de tickets

### Tipo A - Dúvida comercial/uso
Exemplos:
- “Por que meu gerente não conta?”
- “Como funciona pró-rata?”

Tratativa:
- responder com base nas regras oficiais;
- anexar explicação curta e objetiva;
- encaminhar ao comercial apenas se houver pedido de mudança de plano.

### Tipo B - Bloqueio operacional esperado
Exemplos:
- “Não consigo adicionar corretor.”

Tratativa:
1. conferir `usados/limite`;
2. confirmar se tentativa foi de create/reactivate `broker`;
3. oferecer opções: desativar broker inativo ou upgrade imediato.

### Tipo C - Suspeita de bug/inconsistência
Exemplos:
- contador de assento divergente;
- bloqueio com vagas disponíveis;
- upgrade aplicado sem refletir na equipe.

Tratativa:
- abrir incidente técnico com evidências;
- priorizar conforme impacto (P0/P1/P2).

## 4. Fluxo de triagem (SLA suporte)

1. Identificar organização e usuário solicitante.  
2. Classificar ticket em A/B/C.  
3. Coletar evidências mínimas:
- horário;
- ação executada;
- mensagem exibida;
- screenshot.
4. Responder cliente com próximo passo e prazo.
5. Escalar quando aplicável.

SLA recomendado:
- primeira resposta: até 30 min (horário comercial);
- resolução tipo A/B: até 2h;
- tipo C: conforme severidade de incidente.

## 5. Checklist de diagnóstico rápido

- [ ] Ticket é sobre role `broker` ou outro role?
- [ ] Organização está no limite de assentos?
- [ ] Tentativa foi create/reactivate?
- [ ] Houve upgrade recente?
- [ ] Houve virada de ciclo com downgrade agendado?
- [ ] Logs/auditoria confirmam a ação?

## 6. Respostas padrão prontas

### 6.1 Bloqueio por limite (esperado)
"Seu plano atual está com `X/X` corretores ativos.  
Por isso o sistema bloqueia novo corretor para respeitar o contrato.  
Posso te ajudar a desativar um corretor inativo ou aplicar upgrade imediato com pró-rata."

### 6.2 Upgrade aplicado
"Upgrade confirmado e já ativo.  
Seu novo limite foi atualizado e você já pode adicionar o corretor."

### 6.3 Downgrade solicitado
"Downgrade registrado com sucesso para o próximo ciclo.  
Seu acesso atual não será reduzido no meio do período."

### 6.4 Divergência de contador
"Obrigado pelo reporte. Estamos analisando uma possível inconsistência de capacidade.  
Já abrimos investigação com prioridade e retorno estimado em [prazo]."

## 7. Escalonamento

Escalar para operação técnica quando:
- bloqueio ocorrer abaixo do limite;
- contador estiver inconsistente;
- upgrade não refletir em tempo aceitável;
- downgrade aplicar fora da virada de ciclo.

Dados obrigatórios no escalonamento:
- organização;
- usuário;
- timestamp;
- ação tentada;
- mensagem exibida;
- evidência (print/log).

## 8. Critérios de severidade

- P0: múltiplas organizações sem conseguir operar por erro de assento.
- P1: organização não consegue ampliar equipe após upgrade válido.
- P2: mensagens incorretas ou atraso sem bloqueio total.

## 9. Encerramento de ticket

Antes de fechar:
- [ ] cliente confirmou resolução;
- [ ] ação registrada no histórico do ticket;
- [ ] causa raiz classificada (uso esperado x bug);
- [ ] melhoria sugerida registrada (se aplicável).

## 10. Métricas de suporte (E5)

- Tempo de primeira resposta (FRT).
- Tempo médio de resolução por tipo A/B/C.
- Taxa de tickets resolvidos sem escalonamento.
- Taxa de tickets de bloqueio convertidos em upgrade.
- Top 5 causas de contato por assentos/cobrança.

