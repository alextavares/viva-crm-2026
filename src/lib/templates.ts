import { MessageTemplate } from "./types"

type TemplateVariables = {
    contact_name?: string
    broker_name?: string
    [key: string]: string | undefined
}

/**
 * Substitui chaves como {{contact_name}} no texto do template pelos valores fornecidos
 */
export function bindTemplateVariables(content: string, variables: TemplateVariables): string {
    if (!content) return ""

    let result = content

    // Replace each known variable that might be present
    for (const [key, value] of Object.entries(variables)) {
        if (value) {
            // Create a regex to replace all instances of {{key}} globally
            const regex = new RegExp(`{{${key}}}`, "g")
            result = result.replace(regex, value)
        }
    }

    return result
}
