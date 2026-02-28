# STORY-E004-S001 - Regras extras de qualidade para publicacao em massa

## Status
- Completed

## Objetivo
- Reforcar a qualidade da publicacao em massa de imoveis com bloqueios e avisos claros antes do envio ao site/feed.

## Entrega
- Regras centrais em `property-publish-readiness` agora possuem severidade:
  - `blocking`
  - `warning`
- Novos bloqueios:
  - preco ausente ou zerado
  - tipo do imovel nao informado
- Novo aviso:
  - descricao ausente ou curta
- Regras existentes de cidade e foto permanecem como bloqueios.
- `Oculto do site` deixa de ser tratado como pendencia de qualidade.
- A tela de publicacao em massa agora:
  - separa visualmente `Bloqueios` e `Avisos`
  - mostra badge de status (`Bloqueado`, `Aviso`, `Publicavel`)
  - bloqueia a acao de publicar quando houver itens selecionados com bloqueios

## Validacao Esperada
- Imovel com bloqueio nao pode ser publicado em massa ate ser corrigido.
- Imovel com apenas aviso continua publicavel.
- Filtro `Com pendencias` continua listando itens com bloqueios e/ou avisos.
