"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { messageTemplateSchema, MessageTemplateFormValues, MessageTemplate } from "@/lib/types"
import { toast } from "sonner"

interface TemplateFormProps {
    template: MessageTemplate | null
    organizationId: string
    onClose: () => void
    onSaved: (template: MessageTemplate) => void
}

const AVAILABLE_VARIABLES = [
    { key: "{{contact_name}}", label: "Nome do Contato" },
    { key: "{{broker_name}}", label: "Seu Nome (Corretor)" },
]

export function TemplateForm({ template, organizationId, onClose, onSaved }: TemplateFormProps) {
    const [isLoading, setIsLoading] = useState(false)
    const supabase = createClient()

    const form = useForm<MessageTemplateFormValues>({
        resolver: zodResolver(messageTemplateSchema),
        defaultValues: {
            title: template?.title || "",
            content: template?.content || "",
            channel: template?.channel || "whatsapp",
            variables: template?.variables || [],
        },
    })

    const insertVariable = (variable: string) => {
        const currentContent = form.getValues("content")
        // Simple append for now. A more robust implementation would insert at cursor position.
        form.setValue("content", currentContent + (currentContent.length > 0 ? " " : "") + variable)
    }

    const onSubmit = async (data: MessageTemplateFormValues) => {
        setIsLoading(true)

        // Extract variables used in the content
        const usedVariables = AVAILABLE_VARIABLES
            .filter(v => data.content.includes(v.key))
            .map(v => v.key)

        const payload = {
            ...data,
            variables: usedVariables,
            organization_id: organizationId,
        }

        try {
            if (template?.id) {
                const { data: updated, error } = await supabase
                    .from("message_templates")
                    .update(payload)
                    .eq("id", template.id)
                    .select()
                    .single()

                if (error) throw error
                toast.success("Template atualizado com sucesso!")
                onSaved(updated as MessageTemplate)
            } else {
                const { data: inserted, error } = await supabase
                    .from("message_templates")
                    .insert([payload])
                    .select()
                    .single()

                if (error) throw error
                toast.success("Template criado com sucesso!")
                onSaved(inserted as MessageTemplate)
            }
        } catch (error: any) {
            console.error(error)
            toast.error(error.message || "Erro ao salvar template")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{template ? "Editar Template" : "Novo Template"}</DialogTitle>
                    <DialogDescription>
                        Crie mensagens padronizadas para enviar aos seus contatos.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Título de referência</Label>
                        <Input
                            id="title"
                            placeholder="Ex: Primeira Abordagem"
                            {...form.register("title")}
                        />
                        {form.formState.errors.title && (
                            <p className="text-sm text-red-500">{form.formState.errors.title.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="channel">Canal</Label>
                        <Select
                            defaultValue={form.getValues("channel")}
                            onValueChange={(val: "whatsapp" | "email") => form.setValue("channel", val)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o canal" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                <SelectItem value="email">E-mail</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="content">Conteúdo da Mensagem</Label>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-2">
                            {AVAILABLE_VARIABLES.map((v) => (
                                <Button
                                    key={v.key}
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="text-xs h-7"
                                    onClick={() => insertVariable(v.key)}
                                >
                                    +{v.label}
                                </Button>
                            ))}
                        </div>

                        <Textarea
                            id="content"
                            placeholder="Escreva sua mensagem aqui..."
                            className="min-h-[150px] resize-none"
                            {...form.register("content")}
                        />
                        {form.formState.errors.content && (
                            <p className="text-sm text-red-500">{form.formState.errors.content.message}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Dica: Use os botões acima para inserir o nome do contato ou o seu nome na mensagem.
                        </p>
                    </div>

                    <DialogFooter className=" pt-4">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? "Salvando..." : "Salvar Template"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
