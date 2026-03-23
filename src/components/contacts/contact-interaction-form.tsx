'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Phone, Mail, MapPin, FileText, MessageSquare, Loader2, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'

type InteractionType = 'call' | 'email' | 'visit' | 'note' | 'whatsapp'
type Direction = 'inbound' | 'outbound'

const TYPE_OPTIONS: { value: InteractionType; label: string; icon: React.ElementType }[] = [
    { value: 'call', label: 'Ligação', icon: Phone },
    { value: 'email', label: 'E-mail', icon: Mail },
    { value: 'visit', label: 'Visita', icon: MapPin },
    { value: 'note', label: 'Anotação', icon: FileText },
    { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
]

interface Props {
    contactId: string
    organizationId: string
    onSuccess?: () => void
}

export function ContactInteractionForm({ contactId, organizationId, onSuccess }: Props) {
    const supabase = createClient()
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [type, setType] = useState<InteractionType>('call')
    const [direction, setDirection] = useState<Direction>('outbound')
    const [summary, setSummary] = useState('')
    const [saving, setSaving] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!summary.trim()) {
            toast.error('Preencha o resumo da interação.')
            return
        }
        setSaving(true)
        const { error } = await supabase.from('contact_interactions').insert({
            contact_id: contactId,
            organization_id: organizationId,
            type,
            direction: type === 'note' ? null : direction,
            summary: summary.trim(),
            happened_at: new Date().toISOString(),
        })
        setSaving(false)
        if (error) {
            toast.error('Erro ao registrar interação.')
            return
        }
        toast.success('Interação registrada.')
        setSummary('')
        setOpen(false)
        onSuccess?.()
        router.refresh()
    }

    if (!open) {
        return (
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Registrar interação
            </Button>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-card p-4">
            <div className="grid grid-cols-2 gap-3">
                <Select value={type} onValueChange={(v) => setType(v as InteractionType)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                        {TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                <span className="flex items-center gap-2">
                                    <opt.icon className="h-3.5 w-3.5" />
                                    {opt.label}
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {type !== 'note' && (
                    <Select value={direction} onValueChange={(v) => setDirection(v as Direction)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Direção" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="outbound">Saída (ativo)</SelectItem>
                            <SelectItem value="inbound">Entrada (recebido)</SelectItem>
                        </SelectContent>
                    </Select>
                )}
            </div>

            <Textarea
                placeholder="Resumo da interação..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
                className="resize-none"
            />

            <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                    Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Salvar
                </Button>
            </div>
        </form>
    )
}
