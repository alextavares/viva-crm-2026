ALTER TABLE public.ai_lead_reengagement_settings
  ADD COLUMN IF NOT EXISTS inactive_message_template text,
  ADD COLUMN IF NOT EXISTS handoff_message_template text,
  ADD COLUMN IF NOT EXISTS final_escalation_delay_minutes integer NOT NULL DEFAULT 30;

UPDATE public.ai_lead_reengagement_settings
SET
  inactive_message_template = COALESCE(
    NULLIF(trim(inactive_message_template), ''),
    NULLIF(trim(message_template), ''),
    'Olá {{first_name}}, seguimos por aqui para te ajudar com sua busca. Se quiser, posso retomar seu atendimento agora.'
  ),
  handoff_message_template = COALESCE(
    NULLIF(trim(handoff_message_template), ''),
    'Olá {{first_name}}, seu atendimento segue em andamento por aqui. Se quiser continuar agora, me responda nesta conversa.'
  )
WHERE inactive_message_template IS NULL
   OR trim(inactive_message_template) = ''
   OR handoff_message_template IS NULL
   OR trim(handoff_message_template) = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_lead_reengagement_settings_final_delay_check'
  ) THEN
    ALTER TABLE public.ai_lead_reengagement_settings
      ADD CONSTRAINT ai_lead_reengagement_settings_final_delay_check
      CHECK (final_escalation_delay_minutes >= 1);
  END IF;
END $$;
