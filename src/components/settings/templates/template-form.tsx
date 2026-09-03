"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { messageTemplateSchema, MessageTemplateFormValues, MessageTemplate } from "@/lib/types"
import { toast } from "sonner"
import { saveMessageTemplate } from "@/app/actions/settings"

type MessageTemplateFormInput = z.input<typeof messageTemplateSchema>

function resolveTemplateChannel(channel?: string | null): MessageTemplateFormValues["channel"] {
    return channel === "email" ? "email" : "whatsapp"
}

interface TemplateFormProps {
    template: MessageTemplate | null
    onClose: () => void
    onSaved: (template: MessageTemplate) => void
}

const AVAILABLE_VARIABLES = [
    { key: "{{contact_name}}", label: "Nome do Contato" },
    { key: "{{broker_name}}", label: "Seu Nome (Corretor)" },
]

export function TemplateForm({ template, onClose, onSaved }: TemplateFormProps) {
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const form = useForm<MessageTemplateFormInput, unknown, MessageTemplateFormValues>({
        resolver: zodResolver(messageTemplateSchema),
        defaultValues: {
            title: template?.title || "",
            content: template?.content || "",
            channel: resolveTemplateChannel(template?.channel),
            variables: template?.variables || [],
        },
    })

    const insertVariable = (variable: string) => {
        const currentContent = form.getValues("content")
        // Simple append for now. A more robust implementation would insert at cursor position.
        form.setValue("content", currentContent + (currentContent.length > 0 ? " " : "") + variable)
    }

    const onSubmit = async (data: MessageTemplateFormValues) => {
        setErrorMsg(null)

        const usedVariables = AVAILABLE_VARIABLES
            .filter(v => data.content.includes(v.key))
            .map(v => v.key)

        startTransition(() => {
            void (async () => {
                const result = await saveMessageTemplate({
                    id: template?.id,
                    title: data.title,
                    content: data.content,
                    channel: data.channel,
                    variables: usedVariables,
                })

                if (!result.success) {
                    setErrorMsg(result.error)
                    toast.error(result.error)
                    return
                }

                toast.success(template?.id ? "Template atualizado com sucesso!" : "Template criado com sucesso!")
                onSaved(result.data.template)
            })()
        })
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
                        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? "Salvando..." : "Salvar Template"}
                        </Button>
                    </DialogFooter>
                    {errorMsg ? <p className="text-sm text-red-600">{errorMsg}</p> : null}
                </form>
            </DialogContent>
        </Dialog>
    )
}
