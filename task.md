# Imobi CRM – Status de Execução

## Prioridade Atual — Piloto Vendável

Documento guia: `docs/release-plan-vendavel-2026-04-23.md`
Go/No-Go: `docs/go-no-go-vendavel-2026-04-23.md`
Roteiro demo: `docs/demo-script-vendavel-2026-04-23.md`
Sprint atual: `docs/sprint-acabamento-operacional-2026-04-23.md`
Roteiro piloto: `docs/piloto-assistido-roteiro-2026-04-24.md`
Template feedback: `docs/piloto-assistido-feedback-template-2026-04-24.md`

Decisão atual:
- GO para piloto vendável em ambiente local limpo;
- GO para demo assistida;
- GO para piloto assistido com usuário real após sprint curta de acabamento operacional;
- NO-GO para self-service sem acompanhamento;
- congelar novas features grandes até coletar feedback real do piloto;
- preservar como diferencial: CRM imobiliário operacional + WhatsApp sandbox/oficial + IA de pré-atendimento + distribuição/SLA + funil/relatórios simples.

Comandos-gate da versão vendável:
- `npx tsc --noEmit --pretty false`
- `npm test`
- `npm run lint`
- `npm run build`

Status em 2026-04-23:
- gates técnicos estabilizados;
- build passou;
- `npx supabase db reset --local --yes` validado com `supabase/qa_seed.sql`;
- P1 de schema, imóveis, distribuição, propostas, contratos, relatórios e slug demo resolvidos em ambiente limpo;
- WhatsApp sandbox demonstrável e envio sandbox registrado no CRM;
- nenhum P0/P1 aberto na instância limpa validada.
- instância estável `http://localhost:3000` revalidada com `npm run start -- -p 3000`: GO para demo vendável;
- auditoria UX/operacional classificou o produto como piloto assistido sim, self-service não.
- sprint de acabamento operacional executada em 2026-04-24: gates PASS, smoke QA PASS, P1 nenhum, decisão GO para piloto assistido com usuário real.
- validação em domínio público em 2026-04-26: captação pública GO pelo detalhe do imóvel; home pública não é ponto de captação.
- revalidação da sprint em 2026-04-26: gates PASS, smoke QA PASS, nenhum P1, sem alteração de código de produto nesta rodada.

Próxima etapa: rodar piloto assistido com usuário real, registrar feedback e só então abrir próximo sprint.

## Ciclos Concluídos

### Ciclo 7 — Confiabilidade e Regras de Negócio
- [x] Testes automatizados base (Jest + Playwright)
- [x] RLS granular de UPDATE (contacts, properties, appointments)
- [x] `/appointments/[id]` + edição + ações
- [x] Kanban sem paginação curta (modo board com range ampliado)
- [x] Ajustes de responsividade nas listas principais

### Patch 7.1 — Fechamento Real
- [x] `eslint.config.mjs` ignorando artefatos (`playwright-report/**`, `test-results/**`, `coverage/**`)
- [x] Migração `jest.config.js` -> `jest.config.mjs`
- [x] RBAC de delete em appointment usando `role` do contexto + `isAdmin(role)`
- [x] E2E login alinhado ao UI real

### Ciclo 8 — Produção
- [x] `src/app/global-error.tsx` (error boundary global)
- [x] `src/app/not-found.tsx` (404 custom)
- [x] Skeleton loaders:
  - [x] `src/app/(dashboard)/properties/loading.tsx`
  - [x] `src/app/(dashboard)/contacts/loading.tsx`
  - [x] `src/app/(dashboard)/appointments/loading.tsx`
- [x] Limpeza de testes (`src/__tests__/types.test.ts`) e remoção de arquivo temporário (`src/__tests__/debug-schema.ts`)

### Patch 8.1 — Build Sem Warnings
- [x] `next.config.ts` com `turbopack.root` absoluto
- [x] Migração `src/middleware.ts` -> `src/proxy.ts`
- [x] Build limpo (sem warnings)
- [x] Build limpo (sem warnings)
- [x] Auditoria de Segurança: Middleware ativo (revertido para `src/middleware.ts` por solicitação explícita)
- [x] Implementação RLS: Script SQL aplicado com sucesso via Supabase MCP
- [x] Correção Recursão RLS: Função `get_auth_org_id()` implementada para evitar loop infinito em `profiles/properties`
- [x] Alinhamento Schema: RPCs do site público e tabelas `contact_events`/`messages` alinhados com produção

### Ciclo 9.5 — Settings Hub e Site Assets
- [x] `/settings` como hub de cards
- [x] `/settings/site` para admin do site (Owner/Manager)
- [x] Gestão de `site_settings` e páginas públicas
- [x] Integração com Storage: Bucket `site-assets` e policies aplicadas
- [x] Banners: CRUD MVP com upload de imagem
- [x] Fix Site Settings Hang (robust error handling + public client)
- [x] Migration: properties external_id (20260214)
- [x] Cleanup properties univen (demo-vivacrm): Executed (0 rows found)
- [x] Migration: feed_properties hide_from_site (20260215) - Failed (missing portal_integrations)
- [x] Migration: site_list_properties search by external_id (20260215)
- [x] Validation: site_list_properties search (demo-vivacrm) -> 1 record found

### Ciclo 10.4 — Pipeline de Qualidade (CI)
- [x] Workflow GitHub Actions criado: `.github/workflows/ci.yml`
- [x] Gatilhos em `push` e `pull_request` para `main`
- [x] Execução automática de `npm ci`, `npm run lint`, `npm test`, `npm run build`
- [x] Concurrency habilitado para evitar jobs duplicados em branch

### Ciclo 10.5 — Deploy Manual (Staging/Produção)
- [x] Workflow de deploy criado: `.github/workflows/deploy.yml`
- [x] `workflow_dispatch` com alvo (`staging` ou `production`)
- [x] Quality gate obrigatório antes do deploy
- [x] Deploy Vercel via CLI com `vercel pull/build/deploy`
- [x] Smoke test automático pós-deploy (`/`, `/robots.txt`, `/login`)

### Sprint 1 — Follow-up Automático
- [x] Migração aplicada: `20260220133000_followup_automation.sql`
- [x] Estruturas criadas: `followup_settings`, `followup_jobs`, trigger em `contact_events`
- [x] Tela admin: `/settings/followup` (ativar/desativar + templates 5m/24h/3d)
- [x] Painel por contato: visualização e ações `pause/resume/cancel` em `/contacts/[id]`
- [x] Endpoint de processamento: `POST /api/jobs/followups/process` (200 OK validado)
- [x] QA externo concluído (PASS) com evidência funcional ponta a ponta

### Sprint 2 — Distribuição de Leads + SLA (Fase 1)
- [x] Migração criada: `20260220152000_lead_distribution_sla.sql`
- [x] Round-robin automático para `broker` via trigger em `contact_events` (`lead_received`)
- [x] Configuração admin em `/settings/leads` (`enabled`, `sla_minutes`, `redistribute_overdue`)
- [x] Endpoint de redistribuição por SLA: `POST /api/jobs/leads/redistribute`
- [x] Indicador visual SLA (verde/amarelo/vermelho) em `/contacts`
- [ ] QA externo do Sprint 2 (pendente)


## Verificação Atual (executada no workspace)
- [x] `npm run lint` (pass)
- [x] `npm test` (2 suites, 6 testes, pass)
- [x] `npm run test:e2e` (1 teste, pass)
- [x] `npm run build` (pass, sem warnings)
- [x] Validação Site Público: `site_list_properties` e `site_get_property` (OK)
- [x] Validação Lead Capture: `site_create_lead` -> contacts/events/messages (OK, tabelas criadas)
- [x] Ciclo 9.5: Build, Lint e Tests (OK)
- [x] Ciclo 9.5: Bucket `site-assets` e RLS policies (Aplicado)

## Pendências de Liberação
- [ ] QA externo do Sprint 2 (Distribuição de Leads + SLA) — pendente

## Backlog Futuro
- [ ] Optimistic updates nos fluxos críticos (contacts/properties/appointments/kanban)
- [ ] Expandir E2E para CRUD core e permissões
- [x] Pipeline de deploy em staging/produção (Vercel + variáveis + smoke tests)
- [ ] IA para fotos de imóveis (futuro):
  - [ ] melhoria automática (iluminação, nitidez, redução de ruído)
  - [ ] pipeline assíncrono com status
  - [ ] controle de consumo/créditos por organização
