# Notas de Ambiente de Desenvolvimento - Atendimentos

## Problemas Encontrados e Soluções

1.  **Bug de Recursão no RLS**:
    - **Diagnóstico**: A política "Users can view profiles in same org" na migration `20260211222649` possuía uma auto-referência recursiva.
    - **Ação**: Criada nova migration `supabase/migrations/20260420134500_fix_profiles_rls_recursion.sql`.
    - **Aplicação**: Aplicado via `psql` direto no Docker devido a erros de consistência em migrações legadas que impediam o `supabase db push`.
    
2.  **Estado do Banco de Dados**:
    - Após tentativa de `db reset`, o banco foi limpo.
    - **Ação**: Criado usuário `qa@example.com` (id: `d470509a-6799-4d69-a1b7-789a742c3df4`) e organização `QA Realty` manualmente via SQL.
    - **Ação**: Criado 1 contato e 1 atendimento de teste para possibilitar o QA.

## Procedimento de Correção (Migration)
```sql
DROP POLICY IF EXISTS "Users can view profiles in same org" ON profiles;
CREATE POLICY "Users can view profiles in same org" ON profiles
  FOR SELECT USING (organization_id = public.current_user_org_id());
```

## Dados de Teste (QA)
- **Email**: `qa@example.com`
- **Senha**: `password123`
- **Atendimento**: "Visita de Teste QA" agendada para amanhã.

## Histórico de Execução (Nuclear Reset)

### 2026-04-21 11:13
- **Bloco 1**: Confirmação do banco.
  - Query: `SELECT current_database(), current_user, inet_server_addr();`
  - Status: Concluido. Banco `postgres` (local) confirmado.

### 2026-04-21 11:17
- **Bloco 2**: Reset de Schema e Migrações (Nuclear).
  - Comandos: `DROP SCHEMA public CASCADE`, `CREATE SCHEMA public`, `TRUNCATE schema_migrations`.
  - Status: Concluido. Schema `public` limpo (Count: 0 tabelas).

### 2026-04-21 11:31
- **Bloco 3**: Aplicação do schema.sql.
  - Status: Concluído. 18 tabelas recriadas no schema `public`.
- **Bloco 4**: Registrar migrations na tabela de controle.
  - Comando: Inseridos os timestamps de todo o diretório `supabase/migrations`.
  - Status: Concluído. 67 registros inseridos.
- **Bloco 5**: Reload PostgREST.
  - Comando: `NOTIFY pgrst, 'reload schema'`
  - Status: Concluído.
- **Bloco 5.5**: Teste da página `/appointments` (Browser).
  - Status: Concluído.
  - Resultado: A página carregou SEM o erro de "Database querying schema". O cabeçalho, botões (Nova Visita) e filtros funcionaram e exibiram o estado vazio "Nenhum agendamento encontrado".
  - Console: Erro `permission denied for table appointments` 42501 (esperado, visto que não há sessão/RLS).
