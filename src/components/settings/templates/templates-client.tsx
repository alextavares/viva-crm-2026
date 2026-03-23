"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, Mail, MessageSquare } from "lucide-react"
import { TemplateForm } from "./template-form"
import { MessageTemplate } from "@/lib/types"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"

interface TemplatesClientProps {
    initialTemplates: MessageTemplate[]
    isAdmin: boolean
    organizationId: string
}

export function TemplatesClient({ initialTemplates, isAdmin, organizationId }: TemplatesClientProps) {
    const [templates, setTemplates] = useState<MessageTemplate[]>(initialTemplates)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleDelete = async (id: string) => {
        if (!isAdmin) {
            toast.error("Apenas administradores podem excluir templates.")
            return
        }

        if (!confirm("Tem certeza que deseja excluir este template?")) {
            return
        }

        setIsLoading(true)
        try {
            const { error } = await supabase.from("message_templates").delete().eq("id", id)

            if (error) throw error

            setTemplates(templates.filter((t) => t.id !== id))
            toast.success("Template excluído com sucesso")
            router.refresh()
        } catch (error: any) {
            console.error(error)
            toast.error(error.message || "Erro ao excluir template")
        } finally {
            setIsLoading(false)
        }
    }

    const handleEdit = (template: MessageTemplate) => {
        setEditingTemplate(template)
        setIsFormOpen(true)
    }

    const handleCreate = () => {
        setEditingTemplate(null)
        setIsFormOpen(true)
    }

    const onSaved = (template: MessageTemplate) => {
        setTemplates((prev) => {
            const exists = prev.find((t) => t.id === template.id)
            if (exists) {
                return prev.map((t) => (t.id === template.id ? template : t))
            }
            return [template, ...prev]
        })
        setIsFormOpen(false)
        router.refresh()
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-tight">Seus Templates</h2>
                <Button onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Template
                </Button>
            </div>

            {templates.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                        <MessageSquare className="h-10 w-10 text-muted-foreground mb-4 opacity-20" />
                        <h3 className="text-lg font-medium">Nenhum template</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            Crie templates com variáveis para usar no contato rápido com seus leads.
                        </p>
                        <Button onClick={handleCreate} variant="outline" className="mt-4">
                            <Plus className="mr-2 h-4 w-4" />
                            Criar o Primeiro
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {templates.map((template) => (
                        <Card key={template.id} className="relative group overflow-hidden">
                            <CardContent className="p-5 flex flex-col h-full">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2 text-primary font-medium truncate">
                                        {template.channel === "whatsapp" ? (
                                            <MessageSquare className="h-4 w-4" />
                                        ) : (
                                            <Mail className="h-4 w-4" />
                                        )}
                                        <span className="truncate">{template.title}</span>
                                    </div>
                                </div>

                                <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">
                                    {template.content}
                                </p>

                                <div className="flex items-center justify-between mt-auto pt-4 border-t">
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEdit(template)}
                                            className="px-2"
                                        >
                                            Editar
                                        </Button>
                                    </div>
                                    {isAdmin && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => handleDelete(template.id)}
                                            disabled={isLoading}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {isFormOpen && (
                <TemplateForm
                    template={editingTemplate}
                    organizationId={organizationId}
                    onClose={() => setIsFormOpen(false)}
                    onSaved={onSaved}
                />
            )}
        </div>
    )
}
