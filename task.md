# Imobi CRM – Status de Execução

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


## Verificação Atual (executada no workspace)
- [x] `npm run lint` (pass)
- [x] `npm test` (2 suites, 6 testes, pass)
- [x] `npm run test:e2e` (1 teste, pass)
- [x] `npm run build` (pass, sem warnings)
- [x] Validação Site Público: `site_list_properties` e `site_get_property` (OK)
- [x] Validação Lead Capture: `site_create_lead` -> contacts/events/messages (OK, tabelas criadas)
- [x] Ciclo 9.5: Build, Lint e Tests (OK)
- [x] Ciclo 9.5: Bucket `site-assets` e RLS policies (Aplicado)

## Backlog Futuro
- [ ] Optimistic updates nos fluxos críticos (contacts/properties/appointments/kanban)
- [ ] Expandir E2E para CRUD core e permissões
- [ ] Pipeline de deploy em staging/produção (Vercel/Railway + variáveis + smoke tests)
- [ ] IA para fotos de imóveis (futuro):
  - [ ] melhoria automática (iluminação, nitidez, redução de ruído)
  - [ ] pipeline assíncrono com status
  - [ ] controle de consumo/créditos por organização
