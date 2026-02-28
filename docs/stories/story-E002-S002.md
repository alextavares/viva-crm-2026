# STORY-E002-S002 - Relatorio simples de metas por corretor para gestor

## Status
- Completed

## Objetivo
- Exibir, na propria pagina de metas, um relatorio simples para owner/manager com as metas efetivas por corretor.

## Entrega
- Relatorio incorporado em `/settings/goals`, abaixo do formulario de configuracao.
- Tabela com:
  - corretor
  - status da meta
  - periodo efetivo
  - realizado do periodo por metrica no formato `realizado / meta (X%)`
  - SLA efetivo
  - badge indicando origem `Global` ou `Override` em cada campo
- Calculo de realizado reaproveita a funcao SQL `public.goals_dashboard_snapshot(...)`.

## Validacao Esperada
- Owner/manager visualiza o relatorio ao abrir `/settings/goals`.
- Corretor sem permissao de gestao nao visualiza o relatorio.
- Quando nao ha corretores, a tela mostra estado vazio claro.
