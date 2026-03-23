# Planejamento da Sprint 7: Polimento e Redução de Atrito

Este documento propõe o escopo da Sprint 7, baseando-se estritamente na consolidação operacional e em atritos reais enfrentados pelos corretores ("smoke bugs" e débitos técnicos mapeados), sem expandir o produto para novas features funcionais.

---

## 1. O que já está suficientemente estável
O coração da operação do corretor roda com segurança nas seguintes frentes:
* **Base de Listagens:** Tabelas densas de Imóveis e Contatos operam com velocidade e paginação estáveis, englobando contatos orgânicos e leads vindos do site na mesma visão.
* **Dia a Dia (Dashboard & Agenda):** O dashboard atua firmemente como "pista de pouso", refletindo SLA, leads em atraso e compromissos apenas do dia. O módulo de follow-ups também reage com precisão.
* **Funil e Roles:** O "Pronto para Corretor" no Kanban e as proteções de controle limitando acessos críticos (administradores x corretores) estão funcionalmente garantidos, assim como a geração automática inicial de um contrato rascunho mediante o aceite de uma proposta.

---

## 2. Os 3 maiores atritos restantes
1. **Fricção na Timeline/Histórico do Contato (UX):** É o local de maior tempo de tela. A inserção de anotações (notes/logs) e registros de contatos diários ainda não é "irretocável". A leitura e o fluxo de registro demandam um polimento forte de usabilidade.
2. **Ciclo de Vida Obscuro do Contrato (Feedback Visual):** Embora uma proposta aceita crie um Draft de contrato nos bastidores, a evolução de status desse contrato (Rascunho -> Em Assinatura -> Assinado) e o tratamento das regras de exclusão da proposta origem ainda geram edge cases e pouca clareza visual para o corretor que opera.
3. **Ambiguidade de Vínculo Proprietário (UX Misto Lógico):** A insistência do sistema num fallback legado (`owner_name` em texto livre) contrapondo-se ao vínculo estrutural (`owner_contact_id`) causa quebras de links ocasionais nas fichas de imóveis e confusão sobre quem realmente é dono do registro.

---

## 3. Sprint 7: Proposta e Ordem de Execução

A proposta está dividida em 3 tarefas (frentes curtas), priorizando a base de dados primeiro, passando para a redução de cliques do negócio, e terminando no polimento visual puro de rotina.

### Sprint 7 T1: Harmonização Limpa do Vínculo de Proprietários
* **Objetivo:** Matar a heurística frágil de "texto livre" (`owner_name`). Impor/limpar a navegação para que o imóvel obedeça estritamente a um ID de proprietário forte (`owner_contact_id`), eliminando links fantasmas.
* **Foco:** Risco técnico, consistência de navegação.

### Sprint 7 T2: Gestão Visual de Borda em Propostas e Contratos
* **Objetivo:** Adicionar consistência na UI (bloquear exclusão de propostas que possuam contrato nativo vigente), além de exibir indicadores ricos evoluindo o contrato rascunho até "Assinado", garantindo que as permissões sigam travadas.
* **Foco:** Segurança de operação, UI/States e Edge Cases.

### Sprint 7 T3: Polimento Profundo de UX na Timeline de Contato
* **Objetivo:** Redesenhar as margens, espaçamentos, tipografia e o input principal do Histórico de Interações na ficha do Contato. Fazer com que logar uma nota ou visualizar os últimos acompanhamentos leve "zero" atrito cognitivo.
* **Foco:** Layout irretocável, Tailwind refinado, design system centrado no usuário.

---

## 4. Atribuição: Opus vs Gemini

Para executar essa Sprint 7 da forma mais eficiente considerando forças das IAs:

* **T1 e T2 devem ir para o Gemini:** Requerem leitura forte da codebase inteira de schemas (Supabase/Prisma), navegação lateral em dezenas de componentes React para amarrar os botões de ação corretos (`disabled`), e identificação cirúrgica do fluxo atrelado aos Edge Cases da lógica do contrato/proposta ("quem chama quem").
* **T3 deve ir para o Opus:** Requer decisão primária de UI/UX, sensibilidade para leitura de "espaço em branco", harmonia de tipografia, cores para estados de mensagem (Enviado WhatsApp, Notas) e refinamento do "peso visual" de botões num componente restrito e altamente repetitivo (a view do Histórico operada centena de vezes/dia). O layout irretocável é a força do Opus.
