# Onboarding guiado para ativar WhatsApp add-on

**ID:** STORY-E003-S005  
**Epic:** E3 - Conversão via site público e WhatsApp  
**Priority:** Should Have  
**Story Points:** 2  
**Status:** Completed

## User Story
As an **owner/manager**  
I want to **seguir um checklist curto para ativar o add-on sem suporte humano**  
So that **eu chegue mais rápido no primeiro envio com confiança**

## Acceptance Criteria
- [x] Existe checklist de onboarding visível para owner/manager.
- [x] Checklist cobre: contratar add-on, conectar canal, validar envio teste.
- [x] Cada item mostra status claro: pendente, concluído, bloqueado.
- [x] CTA de cada passo leva direto para a tela certa.
- [x] Ao concluir os passos, dashboard mostra estado "pronto para uso".

## Technical Notes
### Implementation Approach
Usar estado derivado de configurações existentes (pricing/canal) com UX guiada por passos.

### Files/Modules Affected
- `src/app/(dashboard)/dashboard/page.tsx`
- `src/components/dashboard/whatsapp-onboarding-checklist.tsx`
- `src/lib/whatsapp-onboarding.ts`

### Data Model Changes
Sem tabela nova obrigatória; pode usar estado calculado por leitura de configurações existentes.

### API Changes
Não obrigatório criar API nova; preferir composição das APIs já existentes de pricing/canal.

## Implementation Notes
- Checklist exibido apenas para `owner/manager` no dashboard.
- Estado derivado de:
  - `whatsapp_addon_pricing_settings.addon_enabled`
  - `whatsapp_channel_settings.status`
  - `whatsapp_channel_settings.last_tested_at`
- Estados por passo:
  - `pendente`, `concluído`, `bloqueado`
- CTAs implementados:
  - Add-on -> `/settings/whatsapp-addon`
  - Canal -> `/settings/whatsapp-channel`
  - Teste -> `/settings/whatsapp-channel`
- Ao concluir os 3 passos, card mostra “Canal oficial pronto para uso”.

### Edge Cases
- Se add-on não contratado, passos dependentes ficam bloqueados.
- Se canal cair depois de concluído, checklist volta para estado pendente no item correto.
- Tenant legado sem WhatsApp add-on deve continuar sem erro.

### Security Considerations
Checklist e ações de ativação só para owner/manager.

## Dependencies
- Blocked by: `STORY-E003-S002`  
- Blocks: none
