# STORY-E006-S003: Interface Administrativa de Portais

## Metadados
- **Épico:** E6 - Integração com Portais XML
- **Prioridade:** Must Have
- **Pontos (Estimativa):** 5
- **Status:** planejado
- **Sprint Planejada:** 9

## Descrição
Como gestor da imobiliária (owner/manager),
Quero uma tela dentro de Configurações (`/settings/portals`) para gerenciar minhas integrações,
Para que eu consiga gerar meu Token único e copiar os links dos Feeds XML para enviar aos meus gerentes no Zap e Imovelweb.

## Critérios de Aceitação
1. **Ponto de Entrada:** Adicionar um Card "Integração Portais XML" na tela `/settings`, listando Zap/VivaReal e Imovelweb.
2. **Nova Tela (`/settings/portals`):** Deve listar os portais suportados.
3. **Card do Portal (Ex: Zap/VivaReal):**
    *   **Estado Inativo:** Mostrar logo do portal e um botão "Ativar Integração".
    *   **Ação de Ativar:** Ao clicar em ativar, o sistema faz um upsert na tabela `portal_integrations` (criando o registro com o `portal = 'zap_vivareal'`, `status = 'active'`, e gera um `feed_token` seguro aleatório no JSON `config`).
    *   **Estado Ativo:** Mostrar a "URL do Feed XML" gerada no formato `https://app.vivacrm.com.br/api/public/s/[slug]/zap-xml?token=[token]`.
    *   **Botão de Copiar:** Permitir copiar facilmente essa URL para a área de transferência.
    *   **Métricas Visuais:** Exibir o `last_sync_at` (Última vez que o portal leu o feed) e "Imóveis Exportados", baseado na quantidade de imóveis disponíveis *vs* regras do portal.
4. **Desativar Integração:** Um botão simples para pausar (trocar `status` para `inactive`), o que faz a rota da API retornar 403 se alguém tentar ler.

## Notas Técnicas
* A geração do token pode ser um simples `crypto.randomUUID().replace(/-/g, '')` salvo no JSONB da coluna `config`.
* Utilizar o hook de `useToast` para dar feedback ao copiar a URL ("Link copiado com sucesso!").
* A mesma tela vai servir para Zap e Imovelweb (basta re-utilizar o layout mudando o portal alvo na API).
