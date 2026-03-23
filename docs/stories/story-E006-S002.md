# STORY-E006-S002: Gerador de Feed XML (Imovelweb)

## Metadados
- **Épico:** E6 - Integração com Portais XML
- **Prioridade:** Must Have
- **Pontos (Estimativa):** 5
- **Status:** planejado
- **Sprint Planejada:** 9

## Descrição
Como gestor da imobiliária (owner/manager),
Quero que o sistema gere um feed XML automático contendo meus imóveis disponíveis no padrão aceito pelo portal Imovelweb,
Para que eu possa sincronizar minha carteira neste portal específico, que possui regras rígidas e diferentes do padrão Zap.

## Critérios de Aceitação
1. **Endpoint Público Autenticado:** A URL do feed deve ser acessível via `GET /api/public/s/[slug]/imovelweb-xml?token=[auth_token]`.
2. **Padrão Imovelweb:** O XML gerado deve respeitar o schema básico do Imovelweb (geralmente baseado em tags como `<imoveis><imovel>...`), que difere do DataZAP. (Ver documentação oficial ou gerar schema compatível `DataWeb`).
3. **Escopo de Imóveis:** O feed deve incluir apenas imóveis com `status = 'available'` e `hide_from_site = false`.
4. **Tradução Específica:** O `zap-mapper` traduziu para o DataZAP. Precisamos de um novo `imovelweb-mapper.ts` que traduza para as descrições e códigos que o Imovelweb espera.
5. **Métricas de Execução:** Toda vez que o feed for acessado com sucesso, atualizar o `last_sync_at` na tabela `portal_integrations` onde `portal = 'imovelweb'`.

## Notas Técnicas
* O schema do Imovelweb costuma usar tags em pt-BR como `<idImovel>`, `<tipoImovel>`, `<precoVenda>`, ou `<Avisos><Aviso>`. Mapear corretamente.
* O processo é idêntico ao da rota do Zap, apenas importando o mapper diferente na route function.
