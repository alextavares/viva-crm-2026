# Estado Atual do CRM (Current State)

Este documento consolida o estado atual de evolução do Imobi CRM, registrando as decisões de produto consolidadas, áreas já sólidas, dívidas técnicas aceitas e os próximos passos. O objetivo é dar clareza rápida para continuidade do desenvolvimento com foco operacional.

---

## 1. O que já está sólido e funcional

As seguintes frentes foram evoluídas e estabilizadas para operação diária:

- **Imóveis:**
  - Ficha completa com informações de captação, mídia e controle de visibilidade (site/portais).
  - Validação de prontidão (Publish Readiness) para portal e site.
  - Listagem em grid e lista densa com múltiplos filtros rápidos.
- **Contatos e Leads do Site:**
  - Integração unificada: contatos de origem orgânica/manual e leads oriundos de portais/site coexistem na mesma visão.
  - Identificação visual unificada de origens ("Site" com domínio vs "Cadastro direto").
  - SLA de atendimento em tempo real (No prazo, Atenção, Atrasado).
- **Acompanhamento (Dashboard & Follow-up):**
  - Dashboard estritamente operacional voltado a responder "o que fazer hoje?".
  - Jobs de follow-up (`followup_jobs`) integrados ao funil, com alertas de pendência.
- **Appointments (Agendamentos):**
  - Ciclo de vida operacional focado (Agendado, Realizado, Cancelado, Não Compareceu).
  - Exibições em calendário e lista/cards integradas ao dia a dia.
- **Permissões (Role Guards):**
  - Sistema simplificado de papéis (`owner`, `manager` e `broker/corretor`).
  - Guardas principais já aplicadas em exclusões críticas (contratos) e ações de follow-up.
  - _Nota:_ Propostas ainda possuem inconsistências conhecidas entre as regras de salvar e excluir.
- **Integrações:**
  - Status badges confiáveis sobre portais, com contabilização de erros e última sincronização visível (ZAP, Imovelweb, OLX).

---

## 2. Decisões de Produto Consolidadas

Padrões de desenvolvimento que não devem ser refeitos ou colocados em cheque neste ciclo de produto:

- **Visão unificada em Contatos:** O `lead` guia o módulo de contatos. Em vez de telas separadas para "Leads" e "Clientes", tudo converge para `Contatos`, diferenciando pelo status de qualificação e funil.
- **UI Pragmática e Densa:** A `lista densa` foi estabelecida como padrão de eficiência em Imóveis e Contatos para suportar operação diária sem excesso de rolagem.
- **Modelo de Propriedade:** `1 imóvel -> 1 proprietário principal`. Embora flexível em tese, a interface de ficha foca no contato principal.
- **Filosofia do Dashboard:** O dashboard não é um BI financeiro. É uma "pista de trabalho" focada em operação diária (tarefas atrasadas, appointments de hoje, alertas do funil e SLA).
- **Resoluções Rápidas (Quick Actions):** Sempre que possível, status (de contato, de compromisso) são alterados no próprio contexto visual via modais ou dropdowns (ex: _ContactListPrimaryAction_), sem recarregar páginas ou navegar para formulários.

---

## 3. Estado atual de estabilização e dívidas aceitas

Após a rodada final de estabilização, o core do CRM pode ser considerado operacionalmente estável para uso diário. Os pontos abaixo permanecem como dívidas aceitas, mas não bloqueiam a operação:

- **Campos JSON não tipados rigidamente:** Ainda existe uso pontual de propriedades dentro de `address` (em Imóveis e Contatos) parseadas com casts de `unknown`.
- **Sem motor complexo de ACL:** Em vez de dezenas de permissões granulares, optamos por um conceito enxuto (owner/manager = administrativos; corretor = operacional limitado no próprio escopo). Aceito para manter velocidade, sem necessidade de sistema complexo usando Casbin/Cerbos agora.
- **Polish residual de interface:** O smoke QA final encontrou apenas 2 pontos pequenos, ambos de baixa severidade:
  - zona morta de clique na borda superior de alguns KPI cards do dashboard;
  - foco visual do campo de nota rápida após envio.

### 3.1 Legado de proprietário

- O frontend já não depende mais de `owner_name` como fallback visual.
- `owner_contact_id` permanece como fonte de verdade para vínculo de proprietário.
- A coluna legada `owner_name` ainda pode existir no banco por compatibilidade histórica, mas não faz mais parte do fluxo operacional do core.

---

## 4. O que continua Congelado (Fora de Escopo Atual)

Para manter o foco no essencial e fechar o core do CRM, as seguintes áreas estão explicitamente paralisadas/não devem ser construídas agora:

- **Módulo Financeiro e Faturamento.** (Sem emissão de boletos, comissões complexas ou fechamento financeiro).
- **Marketing Massivo.** (Pipelines de disparo por e-mail, automações de réguas genéricas ou SMS em lote).
- **Gestão de Suporte/Ticket.** (Helpdesk para inquilinos).
- **Relatórios Avançados e Dashboards Analíticos Gerenciais (BI).** (O foco atual são resumos operacionais simples).
- **Auditoria profunda/Timeline pesada de segurança.** (Logs imutáveis de cada campo editado não são prioridade frente ao tracking simples de interações).
- **Automações de Workflows complexas.** (Fluxogramas no estilo visual tipo Zapier/Make internos da plataforma).

---

## 5. Próximos Passos Recomendados

Com o core estabilizado, o próximo passo recomendado não é abrir nova frente funcional imediatamente. A ordem de decisão sugerida é:

1. **Operação real por alguns dias:** usar o CRM no fluxo normal de trabalho e registrar apenas bugs reais, cliques irritantes e dúvidas recorrentes.
2. **Nova sprint baseada em uso real:** abrir a próxima sprint apenas com base nesses atritos observados, não por hipótese ou expansão especulativa de escopo.
3. **DDL final de limpeza (opcional):** quando fizer sentido, remover a coluna legada `owner_name` do banco em uma etapa separada e controlada, já que o frontend não depende mais dela.

Leitura executiva atual:

- o core do CRM está estável;
- não há bug crítico ou médio remanescente conhecido no fluxo principal;
- o melhor uso do próximo ciclo é aprendizado operacional, não expansão imediata.
