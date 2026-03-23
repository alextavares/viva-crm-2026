# PRD - VivaCRM (Ciclo 90 dias)

Data: 2026-02-24  
Projeto: VivaCRM  
Tipo: Web App SaaS multi-tenant (CRM imobiliário + site público)  
Nível BMAD: 2

## 1. Visão e objetivo

Entregar um CRM imobiliário simples, rápido e difícil de cancelar para corretores autônomos e pequenas imobiliárias, com foco em:

1. Não perder leads.
2. Responder mais rápido.
3. Publicar imóveis com qualidade.
4. Converter melhor com WhatsApp e site público.

## 2. Problema

O público alvo perde negócios por três falhas recorrentes:

1. Leads não recebem follow-up no tempo certo.
2. Distribuição e responsabilidade de atendimento não são claras.
3. Operação diária fica dispersa entre WhatsApp, planilha e portal.

## 3. Escopo do ciclo (90 dias)

## 3.1 Em escopo

1. Follow-up automático por regra de tempo (5min, 24h, 3 dias), com pausa/retomada/cancelamento.
2. Distribuição de leads (round-robin), SLA visível e redistribuição automática.
3. Metas operacionais (captação, resposta rápida, visitas) com configuração global e exceções por corretor.
4. Painel operacional no dashboard com progresso de metas e indicadores de leads.
5. WhatsApp Oficial como add-on opcional (estrutura de pricing e consumo visível).
6. Site público orientado à conversão com captura de lead no CRM.

## 3.2 Fora de escopo

1. IA avançada de leitura profunda de conversas.
2. Automação social/vídeo.
3. Copiloto IA com envio automático de mensagens.
4. Funcionalidades enterprise avançadas de BI.

## 4. Perfis de usuário

1. Dono/gestor da imobiliária (owner/manager):
   - precisa de controle de operação, distribuição, SLA e metas.
2. Corretor (broker):
   - precisa de fluxo rápido de atendimento e visão clara de prioridade.
3. Lead/cliente final:
   - precisa de contato rápido por formulário e WhatsApp.

## 5. Objetivos de negócio e métricas

## 5.1 Objetivos

1. Reduzir churn por baixa utilização operacional.
2. Aumentar taxa de resposta no SLA.
3. Aumentar conversão de leads em atendimento ativo.
4. Viabilizar upsell de WhatsApp Oficial sem elevar complexidade.

## 5.2 KPIs

1. Tempo mediano até primeiro contato.
2. % de leads respondidos dentro do SLA.
3. % de leads com follow-up executado nos 3 marcos.
4. % de corretores batendo metas semanais/mensais.
5. Taxa de retenção (30/60/90 dias).
6. Taxa de ativação do add-on WhatsApp Oficial.

## 6. Requisitos funcionais (FR)

### FR-001 (MUST) - Configuração de Follow-up Automático

Descrição: O sistema deve permitir configurar templates e marcos de follow-up automáticos por organização.

Critérios de aceitação:
1. Owner/manager consegue habilitar/desabilitar follow-up.
2. Marcos padrão 5min, 24h e 3 dias são editáveis.
3. Alterações são persistidas e refletidas em novos leads.

### FR-002 (MUST) - Agendamento automático por novo lead

Descrição: Ao criar lead elegível, o sistema agenda jobs de follow-up.

Critérios de aceitação:
1. Novo lead cria jobs nos três marcos configurados.
2. Jobs ficam visíveis no histórico operacional do lead.
3. Jobs não duplicam para o mesmo marco e lead.

### FR-003 (MUST) - Controle de jobs (pausar/retomar/cancelar)

Descrição: Owner/manager e corretor responsável podem controlar jobs.

Critérios de aceitação:
1. Ações de pausar, retomar e cancelar alteram estado imediatamente.
2. Histórico mantém trilha de auditoria da ação.
3. Job cancelado não executa envio.

### FR-004 (MUST) - Distribuição round-robin

Descrição: Leads novos devem ser distribuídos de forma equilibrada entre corretores elegíveis.

Critérios de aceitação:
1. Round-robin respeita apenas corretores ativos.
2. Regra evita redistribuição para corretor inválido/inativo.
3. Lead recebe corretor responsável no momento da distribuição.

### FR-005 (MUST) - SLA visual por lead

Descrição: Exibir estado de SLA no lead e em listas operacionais.

Critérios de aceitação:
1. Estado mínimo: verde, amarelo, vermelho.
2. SLA considera primeira resposta válida (mensagem ou mudança de status configurada).
3. Estado de SLA atualiza automaticamente sem recarga manual obrigatória.

### FR-006 (MUST) - Redistribuição automática por expiração de SLA

Descrição: Leads sem resposta dentro da janela configurada devem ser redistribuídos conforme regra.

Critérios de aceitação:
1. Job de redistribuição é criado e executado após expiração.
2. Se não houver corretor alternativo válido, sistema mantém responsável atual e registra evento.
3. A redistribuição fica registrada no timeline do lead.

### FR-007 (SHOULD) - Metas globais por organização

Descrição: Owner/manager define metas de captação, resposta rápida e visitas por período.

Critérios de aceitação:
1. Metas aceitam período semanal e mensal.
2. Owner/manager consegue ativar/desativar exibição no dashboard.
3. Dashboard mostra progresso percentual por métrica.

### FR-008 (SHOULD) - Exceções por corretor

Descrição: Permitir customização de meta por corretor, herdando valor global quando vazio.

Critérios de aceitação:
1. Exceções são configuráveis por corretor ativo.
2. Campo vazio herda meta global.
3. Cálculo do dashboard usa regra de precedência (exceção > global).

### FR-009 (MUST) - Captura de lead no site público

Descrição: Formulários públicos criam lead no CRM da organização correta.

Critérios de aceitação:
1. Lead criado com vínculo à organização/slug ou domínio customizado.
2. Evento e mensagem de entrada são registrados no CRM.
3. Feedback de sucesso aparece para o usuário final.

### FR-010 (SHOULD) - WhatsApp Oficial como add-on

Descrição: Produto deve suportar modelo de cobrança desacoplado para WhatsApp Oficial.

Critérios de aceitação:
1. Plano base funciona sem WhatsApp Oficial.
2. Add-on por número é configurável no pricing.
3. Consumo de mensagens é claramente identificado como custo do cliente no provedor.

### FR-011 (COULD) - Onboarding guiado de ativação

Descrição: Exibir checklist de ativação inicial no dashboard.

Critérios de aceitação:
1. Checklist inclui marca/contato, primeiro imóvel, lead teste, domínio próprio.
2. Itens atualizam status automaticamente quando concluídos.
3. Owner/manager pode recolher o checklist sem perder progresso.

### FR-012 (SHOULD) - Qualidade de publicação

Descrição: Exibir pendências de qualidade para imóveis antes de publicar em massa.

Critérios de aceitação:
1. Filtro “com pendências” funciona em publicação em massa.
2. Ação “Corrigir” direciona para campo faltante.
3. Contadores “prontos” e “pendências” refletem estado atual.

## 7. Requisitos não funcionais (NFR)

### NFR-001 (MUST) - Performance de leitura operacional

1. Listas de leads, imóveis e contatos devem responder em até 800ms p95 em condições normais.
2. Filtros em tempo real com debounce devem atualizar percepção do usuário em até 1s.

### NFR-002 (MUST) - Escalabilidade de processamento de jobs

1. Execução de follow-up e SLA deve operar com fila assíncrona.
2. Não usar varreduras full-table por intervalo fixo em front-end.
3. Estrutura deve suportar crescimento de organizações sem acoplamento entre tenants.

### NFR-003 (MUST) - Segurança multi-tenant

1. Todo acesso a dados deve respeitar isolamento por organização.
2. RLS e RPCs devem impedir leitura cruzada entre tenants.
3. Ações administrativas restritas a owner/manager.

### NFR-004 (SHOULD) - Observabilidade e diagnóstico

1. Eventos críticos (redistribuição, erro de job, timeout) devem ser logáveis e rastreáveis.
2. Mensagens de erro de operação devem ser compreensíveis para usuário final.

### NFR-005 (SHOULD) - Confiabilidade operacional

1. Jobs não podem executar duplicado para mesma chave lógica.
2. Falhas transitórias devem permitir retry seguro.

### NFR-006 (SHOULD) - UX mobile-first no site público

1. Captação e contato devem funcionar integralmente em mobile.
2. Elementos de ação (WhatsApp, envio de formulário) devem manter prioridade visual sem confusão.

## 8. Priorização (MoSCoW)

### Must

1. FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-009
2. NFR-001, NFR-002, NFR-003

### Should

1. FR-007, FR-008, FR-010, FR-012
2. NFR-004, NFR-005, NFR-006

### Could

1. FR-011

### Won’t (neste ciclo)

1. IA avançada com resposta automática contextual.
2. Automação de conteúdo social com postagem automática.
3. BI enterprise e relatórios complexos fora do fluxo diário.

## 9. Épicos e histórias (alto nível)

## Epic E1 - Operação de Leads e Follow-up

Valor: Evitar perda de lead e aumentar velocidade comercial.

Histórias:
1. Como gestor, quero configurar follow-up e SLA para padronizar atendimento.
2. Como corretor, quero ver jobs do lead para saber próxima ação.
3. Como gestor, quero redistribuição automática para não deixar lead parado.

## Epic E2 - Metas e gestão de performance

Valor: Dar previsibilidade operacional para gestor e foco diário para corretor.

Histórias:
1. Como gestor, quero metas globais por período para acompanhar resultado.
2. Como gestor, quero exceção por corretor para realidade de cada carteira.
3. Como corretor, quero ver meu progresso no dashboard para priorizar esforço.

## Epic E3 - Conversão via site público e WhatsApp

Valor: Transformar tráfego em lead acionável no CRM com baixo atrito.

Histórias:
1. Como visitante, quero enviar contato rápido no site para receber retorno.
2. Como gestor, quero todo lead do site no CRM certo (tenant correto).
3. Como dono, quero opção de WhatsApp Oficial sem obrigar todos os clientes.

## Epic E4 - Qualidade de publicação

Valor: Melhorar desempenho de anúncio e reduzir erro em portais.

Histórias:
1. Como corretor, quero ver pendências de qualidade antes de publicar.
2. Como corretor, quero ir direto ao campo faltante para corrigir rápido.

## 10. Dependências e restrições

1. Dependência de provedor oficial para WhatsApp (Meta/BSP) no add-on.
2. Dependência de DNS/host para domínio próprio em produção.
3. Dependência de credenciais e políticas corretas no Supabase para RPC/RLS.
4. Restrições de custo: evitar processos de polling agressivo para SLA.

## 11. Critérios de sucesso do ciclo

1. Follow-up e distribuição/SLA em produção sem regressão crítica.
2. Metas visíveis e configuráveis com regra global + exceção por corretor.
3. Captura de lead público consistente (site -> CRM) com evidência no dashboard.
4. UX operacional estável em desktop e funcional em mobile para fluxo de captura.

## 12. Riscos e mitigação

1. Risco: timeouts/locks em operações simultâneas de auth.
   Mitigação: padronizar timeout/retry e evitar concorrência desnecessária.
2. Risco: inconsistência entre ambiente local e produção.
   Mitigação: checklist de go-live e validação por fluxo crítico.
3. Risco: complexidade prematura de IA e automações.
   Mitigação: manter escopo estritamente operacional neste ciclo.

## 13. Traceability (objetivo -> requisitos)

1. Não perder leads -> FR-001..006, FR-009, NFR-002, NFR-003.
2. Responder mais rápido -> FR-005, FR-006, FR-007, NFR-001.
3. Justificar pricing/upsell -> FR-010, KPIs de ativação e retenção.
4. Reduzir churn -> FR-007, FR-008, FR-011, NFR-004.

