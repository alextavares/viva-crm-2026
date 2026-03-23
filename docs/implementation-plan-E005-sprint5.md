# Plano Técnico de Implementação - Sprint 5 (E005 S001/S002)

Data: 2026-02-26  
Escopo: `STORY-E005-S001`, `STORY-E005-S002`  
Objetivo: base comercial por assentos + bloqueio hard limit de `broker` no backend

## 1. Resultado esperado da Sprint 5

- Existe contrato de assentos por organização (`broker_seat_limit`) com ciclo comercial.
- Sistema calcula uso de assentos considerando apenas role `broker` ativo.
- Criação/reativação de `broker` acima do limite é bloqueada no backend.
- API retorna erro comercial claro para consumo na UI.

## 2. Estratégia técnica (arquitetura curta)

- Manter padrão atual: modular monolith (Next.js + Supabase/Postgres).
- Reutilizar padrão de settings já existente (`goal_settings`, `whatsapp_addon_pricing_settings`):
  - tabela por organização;
  - RLS com `current_user_org_id()` e `current_user_role()`;
  - route handlers em `src/app/api/settings/*`.
- Endurecer regra de assentos no banco (fonte de verdade) e repetir validação na API para UX.

## 3. Modelo de dados proposto

### 3.1 Tabela de contrato de assentos
Nome sugerido: `public.broker_seat_plans`

Campos mínimos:
- `organization_id uuid primary key references organizations(id) on delete cascade`
- `broker_seat_limit integer not null check (broker_seat_limit >= 0)`
- `billing_cycle_anchor timestamptz not null`
- `billing_cycle_interval text not null check (billing_cycle_interval in ('monthly','yearly'))`
- `status text not null default 'active' check (status in ('active','inactive'))`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Índices:
- PK já cobre `organization_id`; sem índice extra no MVP.

RLS:
- SELECT: usuários da mesma organização.
- ALL write: `owner/manager` da organização.

### 3.2 Funções SQL
1. `public.count_active_brokers(p_org_id uuid) returns integer`  
Conta perfis `role='broker'` ativos.

2. `public.check_broker_seat_capacity(p_org_id uuid, p_extra integer default 1) returns boolean`  
Compara `count_active_brokers + p_extra <= broker_seat_limit`.

3. `public.get_broker_seat_usage(p_org_id uuid)`  
Retorna `{ used, limit, available }` para Equipe/Cobrança.

## 4. Enforcement de hard limit (S002)

## 4.1 Camada banco (obrigatória)
- Trigger `BEFORE INSERT OR UPDATE OF role, is_active ON profiles`:
  - quando novo estado efetivo for `role='broker'` e ativo;
  - validar capacidade com `check_broker_seat_capacity(...)`;
  - lançar exceção com código de negócio (`P0001`) e mensagem padrão de limite.

Observação:
- Se `profiles` ainda não tiver flag explícita de ativo, usar heurística atual de status em produção e padronizar em sprint seguinte.

## 4.2 Camada API (UX)
- Na rota de gestão de equipe (novo endpoint de Sprint 5), repetir validação antes de persistir.
- Responder `409` para limite atingido:
  - `code: "broker_seat_limit_reached"`
  - `message` humana com `used/limit`.

## 5. Superfície de aplicação (Sprint 5)

Arquivos/alvos sugeridos:
- `supabase/migrations/20260311xxxxxx_broker_seat_plans.sql`
- `supabase/migrations/20260311xxxxxx_broker_seat_enforcement.sql`
- `src/lib/types.ts` (tipos do plano e uso)
- `src/app/api/settings/team/*` (read/write equipe + validação)
- `src/app/(dashboard)/settings/team/page.tsx` (MVP funcional da Equipe)
- `src/app/(dashboard)/settings/page.tsx` (trocar card Equipe de "Em breve" para link ativo)

## 6. Plano de tarefas de desenvolvimento

## 6.1 Backend/DB
1. Criar migração da tabela `broker_seat_plans` + RLS.
2. Criar funções `count_active_brokers`, `check_broker_seat_capacity`, `get_broker_seat_usage`.
3. Criar migração de trigger de enforcement em `profiles`.
4. Criar seed/backfill inicial para organizações existentes.

## 6.2 API
1. Endpoint `GET /api/settings/team`:
- lista brokers;
- retorna uso `used/limit/available`;
- retorna capacidade de criação.

2. Endpoint `POST /api/settings/team`:
- cria/reativa broker;
- retorna `409` quando limite estourar.

3. Endpoint `POST /api/settings/team/deactivate`:
- desativa broker e libera assento.

## 6.3 UI
1. Implementar página Equipe (MVP) com:
- tabela/lista de brokers;
- contador `usados/limite`;
- ação adicionar/reativar/desativar;
- mensagem de bloqueio com CTA de upgrade.

2. Atualizar hub `/settings` para abrir Equipe.

## 7. Ordem de merge recomendada

### PR-1 (base de dados)
- Migrações `broker_seat_plans` + funções + trigger.
- Testes SQL básicos/queries de validação manual.

### PR-2 (API de equipe)
- Endpoints de leitura/escrita.
- Tratamento de erro `broker_seat_limit_reached`.
- Sem UI ainda.

### PR-3 (UI Equipe)
- Tela Equipe consumindo API.
- Contador e bloqueios visíveis.

### PR-4 (hardening)
- ajustes de mensagens;
- logs de auditoria mínimos;
- regressão e limpeza.

Regra:
- Não iniciar PR-3 antes de PR-2 aprovado.
- Não promover para produção sem QA pass da regra de concorrência.

## 8. Testes mínimos (gate de Sprint 5)

Unit:
- cálculo de uso por role (`broker` vs `owner/manager`).
- mapeamento de erro `409 broker_seat_limit_reached`.

Integração:
- create broker no último assento (sucesso).
- create broker acima do limite (falha).
- reactivate broker acima do limite (falha).
- deactivate broker libera assento.

Concorrência:
- duas criações simultâneas para 1 assento restante (apenas uma passa).

E2E:
- owner/manager adiciona broker até limite.
- bloqueio com mensagem amigável + CTA.

## 9. Critérios de pronto (DoD) da Sprint 5

- `S001` e `S002` com acceptance criteria validados.
- QA checklist Sprint 5 marcado como Go.
- Sem regressão em autenticação, settings e perfis existentes.
- Documentação atualizada:
  - `docs/stories/story-E005-S001.md`
  - `docs/stories/story-E005-S002.md`
  - `docs/sprint-status.yaml`

## 10. Riscos e mitigação

- Risco: corrida de criação simultânea de broker.
  Mitigação: trigger no DB + transação.

- Risco: dados legados sem plano.
  Mitigação: backfill de plano default por organização antes de habilitar bloqueio.

- Risco: ambiguidade de "broker ativo".
  Mitigação: documentar critério técnico de ativo no migration SQL e alinhar no domínio.

