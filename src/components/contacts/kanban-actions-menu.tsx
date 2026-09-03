"use client"

"use client"

import { MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { recordExternalWhatsAppAttempt } from "@/app/actions/contacts"
import { buildWhatsAppUrl } from "@/lib/whatsapp"
import { buildBrokerWhatsAppMessage, buildExternalWhatsAppTraceSummary } from "@/lib/whatsapp-context"
import { MessageTemplate, Contact } from "@/lib/types"
import { bindTemplateVariables } from "@/lib/templates"

interface KanbanActionsMenuProps {
    contact: Contact
    templates: MessageTemplate[]
    brokerName: string
}

export function KanbanActionsMenu({ contact, templates, brokerName }: KanbanActionsMenuProps) {
    const whatsappTemplates = templates.filter((t) => t.channel === "whatsapp")

    const handleSend = (template: MessageTemplate | null) => {
        void (async () => {
        if (!contact.phone) return

        let text = ""
        if (template) {
            text = bindTemplateVariables(template.content, {
                contact_name: contact.name,
                broker_name: brokerName,
            })
        } else {
            text = buildBrokerWhatsAppMessage({
                contactName: contact.name,
            })
        }

        const url = buildWhatsAppUrl({ phone: contact.phone, message: text })
        if (!url) return
        const popup = window.open("", "_blank", "noopener,noreferrer")

        const result = await recordExternalWhatsAppAttempt({
            contactId: contact.id,
            summary: buildExternalWhatsAppTraceSummary({}),
        })

        if (!result.success) {
            popup?.close()
            toast.error(result.error)
            return
        }

        if (popup) {
            popup.location.href = url
        } else {
            window.open(url, "_blank", "noopener,noreferrer")
        }
        toast.success("WhatsApp aberto e registrado na timeline.")
        })()
    }

    if (!contact.phone) return null

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                    <MessageCircle className="h-4 w-4" />
                    <span className="sr-only">WhatsApp</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Enviar WhatsApp</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleSend(null)}>
                    Sem Template
                </DropdownMenuItem>

                {whatsappTemplates.length > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        {whatsappTemplates.map((t) => (
                            <DropdownMenuItem key={t.id} onClick={() => handleSend(t)}>
                                {t.title}
                            </DropdownMenuItem>
                        ))}
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
