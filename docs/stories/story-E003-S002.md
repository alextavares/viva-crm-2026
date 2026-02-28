# Configuração do canal WhatsApp oficial por tenant

**ID:** STORY-E003-S002  
**Epic:** E3 - Conversão via site público e WhatsApp  
**Priority:** Must Have  
**Story Points:** 5  
**Status:** Completed

## User Story
As an **owner/manager**  
I want to **conectar o canal WhatsApp oficial da minha imobiliária**  
So that **os envios automáticos e manuais usem o canal correto do meu negócio**

## Acceptance Criteria
- [x] Tela de configuração permite registrar dados do canal (sem expor segredo em texto aberto).
- [x] Estado do canal exibe: desconectado, conectado, erro.
- [x] Teste de conexão retorna feedback claro para usuário não técnico.
- [x] Canal é isolado por organização (não compartilha credencial entre tenants).
- [x] Quando add-on está desligado, UI mostra bloqueio comercial e próximo passo.

## Technical Notes
### Implementation Approach
Criar camada de configuração por tenant e estado de integração desacoplado da lógica de envio.

### Files/Modules Affected
- `supabase/migrations/*_whatsapp_channel_config.sql`
- `src/app/(dashboard)/settings/*`
- `src/app/api/integrations/*`
- `src/lib/whatsapp.ts`

### Data Model Changes
Tabela de configuração de canal oficial por organização (metadados + status).

### API Changes
Endpoints para salvar configuração e validar conexão.

### Edge Cases
- Configuração parcial não pode marcar como conectada.
- Erros de provedor devem ser normalizados para mensagens simples.
- Reconexão deve substituir estado antigo com segurança.

### Security Considerations
Somente owner/manager pode editar. Logs sem segredos.

## Dependencies
- Blocked by: `STORY-E003-S001`  
- Blocks: `STORY-E003-S003`, `STORY-E003-S005`
