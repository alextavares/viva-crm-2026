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
        if (!contact.phone) return

        let text = ""
        if (template) {
            text = bindTemplateVariables(template.content, {
                contact_name: contact.name,
                broker_name: brokerName,
            })
        } else {
            text = `Olá ${contact.name}, tudo bem?`
        }

        // Retira caracteres não numéricos do telefone para o wa.me
        const phoneDigits = contact.phone.replace(/\D/g, "")

        // Cria a URL do WhatsApp Web/App
        const url = new URL(`https://wa.me/${phoneDigits}`)
        url.searchParams.set("text", text)

        window.open(url.toString(), "_blank", "noopener,noreferrer")
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
