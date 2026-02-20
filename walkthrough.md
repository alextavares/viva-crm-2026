# Imobi CRM – Walkthrough Consolidado

## Estado Atual
O projeto está estabilizado até **Ciclo 9.3 (Integrações - MVP)**, com validações principais passando.

## Ciclo 8 + Patch 8.1 (Produção)

### Arquivos alterados e motivo

| Arquivo | Alteração | Motivo |
|---|---|---|
| `next.config.ts` | `turbopack.root` absoluto | Remover warning de root inferido no build |
| `src/proxy.ts` | Novo arquivo de proxy para sessão/auth | Atender convenção Next 16 (substitui middleware) |
| `src/app/global-error.tsx` | Error boundary global | Tratar falhas inesperadas com retry |
| `src/app/not-found.tsx` | Página 404 custom | Melhor UX em rotas inexistentes |
| `src/app/(dashboard)/properties/loading.tsx` | Skeleton de cards | Melhor feedback em carregamento |
| `src/app/(dashboard)/contacts/loading.tsx` | Skeleton de lista | Melhor feedback em carregamento |
| `src/app/(dashboard)/appointments/loading.tsx` | Skeleton de agendamentos | Melhor feedback em carregamento |
| `src/__tests__/types.test.ts` | Limpeza de logs de debug | Reduzir ruído de execução |
| `src/__tests__/debug-schema.ts` | Removido | Arquivo temporário sem uso |

## Evidências de validação

Executado localmente no workspace:

```bash
npm run lint
npm test
npm run test:e2e
npm run build
```

Resultado consolidado:
- `npm run lint`: passou (0 errors, 0 warnings)
- `npm test`: passou (2 suites, 6 testes)
- `npm run test:e2e`: passou (1 teste)
- `npm run build`: passou (exit 0, sem warnings)

## Riscos residuais (reais)
- Cobertura E2E ainda inicial para autenticação real (cenários de Kanban usam fixture pública).
- Deploy ainda depende de configuração da infraestrutura (variáveis, ambiente, smoke checks).
- IA de fotos está planejada, mas fora do escopo implementado.

## Próximos passos recomendados
1. Expandir E2E para fluxo autenticado real (session/cookies) e rotas protegidas.
2. Fechar pipeline de deploy/staging e checklist de produção.
3. Iniciar fase de design técnico da IA de fotos (sem implementação imediata).

## Ciclo 10.4 - Pipeline de Qualidade (CI)

### Entregue

- Workflow criado em `.github/workflows/ci.yml`.
- Execução automática no GitHub Actions para:
  - `pull_request` -> `main`
  - `push` -> `main`
- Job único de qualidade com:
  - `npm ci`
  - `npm run lint`
  - `npm test`
  - `npm run build`
- `concurrency` habilitado para cancelar runs antigos da mesma branch/referência.

### Observações técnicas

- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` foram definidos com valores de placeholder no workflow para garantir build determinístico sem segredos de produção.
- O pipeline atual valida qualidade de código e build; deploy continua desacoplado (próximo passo).

## Ciclo 10.5 - Deploy Manual (Staging/Produção)

### Entregue

- Workflow criado em `.github/workflows/deploy.yml`.
- Execução manual via **Actions > Deploy > Run workflow**.
- Input de destino:
  - `staging`
  - `production`
- `quality-gate` obrigatório antes do deploy:
  - `npm ci`
  - `npm run lint`
  - `npm test`
  - `npm run build`
- Deploy com Vercel CLI:
  - `vercel pull`
  - `vercel build`
  - `vercel deploy`
- Smoke test pós-deploy validando HTTP 200:
  - `/`
  - `/robots.txt`
  - `/login`

### Secrets necessários no GitHub (Repository Settings > Secrets and variables > Actions)

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Sem esses 3 secrets, o job de deploy falha cedo com mensagem clara.

## Ciclo 9.1 - Optimistic Update (Kanban)

### Implementação

| Item | Status | Detalhe |
|---|---|---|
| Snapshot rollback | Implementado | Estado anterior (`previousContacts`) salvo antes da mutação para permitir reversão segura em falha |
| Feedback imediato | Implementado | UI atualiza instantaneamente no drag/drop; em erro, rollback + `toast.error` explicativo |
| Consistência servidor-cliente | Implementado | `router.refresh()` após sucesso para revalidar estado final com o servidor |

### Evidências de validação

Executado localmente no workspace:

```bash
npm run lint
npm test
npm run build
```

Resultado consolidado:
- `npm run lint`: passou (0 errors, 0 warnings)
- `npm test`: passou (2 suites)
- `npm run build`: passou (exit 0, sem warnings)

## Hardening: Separação Site Principal x Sites de Clientes

### O que foi ajustado

- Landing e página de preços agora usam slug de demo por variável de ambiente:
  - `NEXT_PUBLIC_DEMO_SITE_SLUG` (fallback: `demo-vivacrm`)
  - Helper: `src/lib/demo-site.ts`
- Scripts de seed agora exigem `--site-slug` obrigatório:
  - `scripts/seed_db.js`
  - `scripts/final_auth_seed.js`
  - `scripts/final_seed.js`
  - `scripts/seed_test_data.js`
- Novo script de limpeza de conteúdo E2E por organização:
  - `scripts/cleanup_site_content.js`

### Comandos de referência

```bash
# Seed (obrigatório informar slug)
node scripts/final_seed.js --site-slug demo-vivacrm
node scripts/seed_test_data.js --site-slug demo-vivacrm
node scripts/seed_db.js --site-slug demo-vivacrm
node scripts/final_auth_seed.js --site-slug demo-vivacrm

# Se não existir SUPABASE_SERVICE_ROLE_KEY, use também:
# --email e2e.imobicrm.2026@gmail.com --password TempE2E!2026

# Limpeza segura (primeiro simulação)
node scripts/cleanup_site_content.js --site-slug demo-vivacrm --dry-run

# Execução real (usa service role se disponível; sem service role exige --email/--password)
node scripts/cleanup_site_content.js --site-slug demo-vivacrm
```

## Ciclo 9.4 - Site Público (MVP) + Captura de Leads (Entregue)

### Escopo entregue

1. Site público por organização em `/s/[slug]`:
   - Home com busca e listagem de imóveis disponíveis.
   - Detalhe do imóvel `/s/[slug]/imovel/[id]` com formulário de lead.
   - Páginas institucionais `/s/[slug]/about`, `/contact`, `/lgpd`.
2. Captura de lead via RPC:
   - `site_create_lead(...)` cria/reusa contato e grava timeline (`contact_events`) + mensagem (`messages`).
3. UX para corretores:
   - Botão “Falar no WhatsApp” no detalhe do imóvel.
   - Página de contato com WhatsApp/e-mail e um formulário que entra no CRM.
4. Ajustes de autenticação/rotas:
   - “Sair” funcional no header.
   - Middleware não bloqueia rotas públicas (`/s/*`) e endpoints públicos necessários.

### Notas importantes
- Multi-tenant: leads do site `/s/{slug}` entram na organização dona daquele `slug`. Se você estiver logado no CRM com outra org, não verá os leads por RLS.
- O texto de sucesso do formulário inclui o `slug` para reduzir confusão (“Destino: CRM da organização …”).

### Evidências de validação
Executado localmente no workspace:

```bash
npm run lint
npm test
npm run build
```

Resultado consolidado:
- `npm run lint`: passou
- `npm test`: passou
- `npm run build`: passou

## Ciclo 9.5 - Settings Hub + Admin do Site + Import Hooks (Design Aprovado)

### Objetivo
Ter um painel simples para o corretor/imobiliária configurar o site (sem precisar “hospedar imagem”) e preparar o produto para clientes que vão **importar uma base existente** de imóveis/contatos.

### Entregáveis do sprint (MVP)

1. `/settings` como hub de cards (escalável):
   - Card “Site Público” → `/settings/site`
   - Card “Importar dados” (pode iniciar como “Em breve”, mas já molda o onboarding)
   - Cards “Equipe”, “Cobrança”, etc (placeholder)
2. `/settings/site` (somente `owner/manager`):
   - `site_settings`: theme, brand_name (obrigatório), cores, WhatsApp (obrigatório), email (obrigatório), phone (opcional), logo (opcional)
   - `site_pages`: editar/publicar About/Contact/LGPD (title/content/is_published)
   - `site_banners`: CRUD de banners (placement, título, texto, link, janela, prioridade, ativo)
3. Upload interno (Supabase Storage) para logo e banner:
   - bucket `site-assets`
   - caminho por organização: `org/{organization_id}/site/...`

### Requisito de Importação (impacta o site)
Para import de imóveis vindos de outros CRMs:
- `hide_from_site = true` por padrão no momento do import (anti-caos)
- fluxo separado “Publicar no site” com checklist (fotos, preço, bairro/cidade) antes de expor ao público

### Não-objetivos (explicitamente fora do sprint)
- Domínio próprio (CNAME/SSL/validação por Host header) fica para sprint seguinte.
- Wizard completo de import (CSV/Excel) pode ser iniciado como placeholder no hub, mas implementação completa é o próximo sprint.
- Portais (Zap/VivaReal/OLX/Imovelweb) continuam fora do foco imediato.

### Requisitos não-funcionais
- Segurança: edição do site restrita a `owner/manager` (RLS e UI). Leitura pública do site continua via RPCs (`anon`).
- Baixo suporte: mensagens de erro humanas (ex: “Falta cidade no imóvel”, não “422 missing field”).
- Confiabilidade: rotas `/s/*` não podem depender de sessão/auth; devem renderizar sem login.

### Decision Log (registro)
- `/settings` como hub de cards (não tabs), para escalar o produto para imobiliárias.
- Upload interno de assets do site (cliente não hospeda imagem).
- `hide_from_site=true` por padrão em import, com publicação intencional depois.
- `/settings/site` acessível apenas por `owner/manager`.

## Ciclo 9.2 - Expansão Testes E2E (Parcial)

### Implementação

| Arquivo | Alteração | Motivo |
|---|---|---|
| `e2e/kanban.spec.ts` | Novos cenários E2E de Kanban (sucesso + erro) | Validar optimistic update e rollback visual com feedback de erro |
| `src/app/public/kanban-e2e/page.tsx` | Página fixture pública para testes | Permitir execução E2E estável sem dependência de OAuth |
| `src/components/leads/leads-kanban.tsx` | `data-testid` + flag `shouldRefreshOnSuccess` | Aumentar testabilidade sem alterar comportamento padrão de produção |

### Cenários cobertos

1. Drag/drop com sucesso no update remoto e atualização imediata da UI.
2. Falha no update remoto com rollback para coluna original e `toast.error`.

### Evidências de validação

Executado localmente no workspace:

```bash
npm run test:e2e
```

Resultado consolidado:
- `npm run test:e2e`: passou (3 testes)

## Ciclo 9.3 - Integrações (MVP)

### Escopo entregue

1. Módulo de Integrações no dashboard (`/integrations`) com cards por portal.
2. Conectar/configurar por portal (`/integrations/[portal]`) com persistência em banco:
   - status ativo/inativo
   - regras não sensíveis em `config` (filtros do feed, atribuição, SLA)
   - URL de feed tokenizada (link “privado”)
3. Endpoint de feed público tokenizado: `/api/feeds/[portal]/[token]` (XML genérico placeholder).
4. “Testar feed” com preview e download do XML + log de execução.
5. Relatório por portal com histórico de execuções (`portal_integration_runs`).
6. Pendências humanas (primeiro validador por portal: **Imovelweb**) gerando `portal_integration_issues`.
7. Endereço estruturado no cadastro de imóveis (salvando em `properties.address` JSONB).

### Arquivos alterados (principais)

| Arquivo | Alteração | Motivo |
|---|---|---|
| `src/app/(dashboard)/integrations/page.tsx` | Lista de portais com métricas (pendências + último run) | Dar visibilidade e reduzir suporte |
| `src/app/(dashboard)/integrations/[portal]/page.tsx` | Form de configuração + geração de feed token | “Conectar portal” low-touch |
| `src/app/(dashboard)/integrations/[portal]/feed-tester.tsx` | Teste do feed + preview + download + log | Diagnóstico sem portal |
| `src/app/(dashboard)/integrations/[portal]/report/page.tsx` | Runs + pendências + ação “Analisar” (imovelweb) | Relatório low-touch |
| `src/app/api/feeds/[portal]/[token]/route.ts` | Endpoint XML tokenizado | Base para portais puxarem feed |
| `src/app/api/integrations/run/route.ts` | Log de execução | Alimentar relatório |
| `src/components/layout/sidebar.tsx` | Item “Integrações” | Acesso direto |
| `src/components/properties/property-form.tsx` | Endereço estruturado | Melhor integração com portais |
| `src/lib/types.ts` | Campos estruturados no schema do imóvel | Persistência consistente |
| `supabase/schema.sql` | Tabelas/RLS + função `feed_properties` + runs/issues | Suporte às integrações |

### Evidências de validação

Executado localmente no workspace:

```bash
npm run lint
npm test
npm run build
```

Resultado consolidado:
- `npm run lint`: passou (0 errors, 0 warnings)
- `npm test`: passou (2 suites)
- `npm run build`: passou (exit 0, sem warnings)
