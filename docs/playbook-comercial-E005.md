# Playbook Comercial - E5 Planos e Assentos de Corretores

Data: 2026-02-26  
Escopo: Operação comercial e suporte para planos com assentos `broker`

## 1. Regras oficiais do produto

- Modelo de venda: plano por organização.
- Assento consumido: apenas role `broker`.
- `owner` e `manager`: não consomem assento.
- Limite de assentos: bloqueio duro para novo/reativação de `broker` acima do plano.
- Upgrade: imediato com pró-rata no ciclo atual.
- Downgrade: agendado para o próximo ciclo.

## 2. Catálogo comercial recomendado

- Plano 1 corretor
- Plano 5 corretores
- Plano 10 corretores
- Plano 20 corretores
- Assento extra: preço unitário por corretor adicional

## 3. Roteiro de venda (SOP)

1. Qualificar cliente:
- É corretor autônomo ou imobiliária?
- Quantos corretores `broker` ativos hoje?
- Quantos corretores pretendem ter em 90 dias?

2. Ofertar plano:
- Oferecer plano com folga mínima de 1 assento.
- Explicar regra de bloqueio por limite.
- Explicar upgrade imediato e downgrade no próximo ciclo.

3. Fechar proposta:
- Confirmar quantidade de assentos contratados.
- Confirmar valor de assento extra.
- Confirmar data de início de ciclo.

4. Ativar no CRM:
- Criar/ajustar plano da organização.
- Confirmar `broker_seat_limit` aplicado.
- Validar tela Equipe com contador `usados/limite`.

## 4. Script curto de argumentação comercial

- “Seu plano inclui X corretores ativos. Dono/gerente não entra nessa conta.”
- “Se precisar ampliar equipe, o upgrade entra na hora e cobramos só pró-rata do período restante.”
- “Se quiser reduzir depois, a mudança entra no próximo ciclo para não travar sua operação no meio do mês.”

## 5. Processo de upgrade (SOP)

1. Receber solicitação (cliente ou bloqueio por limite).  
2. Confirmar novo limite desejado.  
3. Calcular pró-rata do ciclo atual.  
4. Aprovar comercialmente e aplicar upgrade.  
5. Confirmar no sistema: novo limite visível e criação de broker liberada.  
6. Registrar evento de auditoria/comentário interno.

SLA interno recomendado:
- Upgrade em horário comercial: até 30 minutos.
- Upgrade fora do horário: próximo turno útil.

## 6. Processo de downgrade (SOP)

1. Receber solicitação e validar motivo.  
2. Conferir brokers ativos atuais vs novo limite solicitado.  
3. Se ativo > novo limite, orientar redução de equipe antes da virada.  
4. Agendar downgrade para próximo ciclo.  
5. Confirmar com cliente data efetiva.

Regra de segurança:
- Nunca aplicar downgrade imediato no ciclo atual.

## 7. Atendimento de bloqueio por limite

Cenário:
- Cliente tenta adicionar/reativar broker e recebe bloqueio.

Passo a passo:
1. Confirmar contador `usados/limite`.
2. Oferecer duas opções: desativar broker inativo ou fazer upgrade.
3. Se escolher upgrade, seguir SOP de upgrade.
4. Se escolher redução, orientar limpeza de usuários broker inativos.

Mensagem padrão de suporte:
- “Seu plano atual permite X corretores ativos e hoje você está com X/X. Posso liberar mais assentos agora com pró-rata, ou te ajudo a desativar um corretor inativo para continuar sem upgrade.”

## 8. Matriz de decisão rápida

- Cliente no limite e precisa contratar corretor hoje:
  ação: upgrade imediato.
- Cliente quer economizar no próximo mês:
  ação: agendar downgrade próximo ciclo.
- Cliente em dúvida de crescimento:
  ação: plano com folga mínima de 1 assento.

## 9. KPIs comerciais para acompanhamento

- Quantidade de bloqueios por limite por semana.
- Taxa de conversão bloqueio -> upgrade.
- Tempo médio de aplicação de upgrade.
- % de downgrades solicitados vs aplicados.
- Ticket médio por organização (base + assentos extras).

## 10. Checklist operacional por cliente novo

- [ ] Plano e limite de assentos definidos.
- [ ] Ciclo de cobrança configurado.
- [ ] Contador de assentos validado na Equipe.
- [ ] Regra de bloqueio validada (sandbox/staging ou checklist funcional).
- [ ] Contato do decisor financeiro registrado.
- [ ] Orientação de upgrade/downgrade enviada ao cliente.

