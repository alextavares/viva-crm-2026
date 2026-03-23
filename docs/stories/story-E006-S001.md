# STORY-E006-S001: Gerador de Feed XML (Padrão Zap/VivaReal)

## Metadados
- **Épico:** E6 - Integração com Portais XML
- **Prioridade:** Must Have
- **Pontos (Estimativa):** 5
- **Status:** planejado
- **Sprint Planejada:** 9

## Descrição
Como gestor da imobiliária (owner/manager),
Quero que o sistema gere um feed XML automático contendo meus imóveis disponíveis no padrão Zap/VivaReal (DataZAP),
Para que eu possa sincronizar minha carteira de imóveis com os maiores portais imobiliários do Brasil sem trabalho duplo.

## Critérios de Aceitação
1. **Endpoint Público Autenticado por Token:** A URL do feed deve ser acessível via `GET /api/public/s/[slug]/zap-xml?token=[auth_token]`, para evitar raspagem desautorizada de dados.
2. **Padrão DataZAP:** O XML gerado deve respeitar o schema básico aceito pelo Grupo ZAP/OLX (contendo `Listing`, `Title`, `Details`, `Location`, `Media`, etc).
3. **Escopo de Imóveis:** O feed deve incluir apenas imóveis com `status = 'available'` e `hide_from_site = false` (ou uma flag específica para portais, mas por MVP usaremos a mesma de visibilidade).
4. **Tradução de Tipos:** O campo `type` do banco (apartment, house, land, commercial) deve ser mapeado para os equivalentes em PT-BR esperados pelo portal (Apartamento, Casa, Lote/Terreno, Comercial).
5. **Mídia (Imagens):** O array de `images` deve ser traduzido em tags `<Item medium="image">` no XML.
6. **Métricas de Execução:** Toda vez que o feed for acessado com sucesso, o sistema deve registrar a chamada atualizando o `last_sync_at` na tabela `portal_integrations`.

## Notas Técnicas
* Utilizar a biblioteca `xmlbuilder2` (ou similar) no backend Node.js (Next.js App Router) para montar a string XML.
* Validar a performance para não carregar a memória. Caso a imobiliária tenha muitos imóveis, o endpoint deve responder num tempo aceitável (streaming ou construção em lote), mas para o MVP, buscar todos em uma query e montar deve ser suficiente (limite < 1000 imóveis).
* O Token será salvo em `portal_integrations.config->>'feed_token'`, a ser gerado na interface na próxima história de ativação. Para este backend MVP, a rota valida esse token.

## Dependências
- Tabela `properties`
- Tabela `portal_integrations` para validar o token.
