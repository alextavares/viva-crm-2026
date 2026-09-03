export function isMissingAiSchemaErrorMessage(message: string) {
  return /ai_lead_sessions|ai_lead_messages|PGRST205|42P01|42703/i.test(message)
}
