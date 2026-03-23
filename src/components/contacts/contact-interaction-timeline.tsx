import { Phone, Mail, MapPin, FileText, MessageSquare, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Interaction = {
    id: string
    type: 'call' | 'email' | 'visit' | 'note' | 'whatsapp'
    direction: 'inbound' | 'outbound' | null
    summary: string
    happened_at: string
    profiles: { full_name: string | null } | null
}

const TYPE_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    call: { icon: Phone, color: 'bg-blue-100 text-blue-700', label: 'Ligação' },
    email: { icon: Mail, color: 'bg-purple-100 text-purple-700', label: 'E-mail' },
    visit: { icon: MapPin, color: 'bg-emerald-100 text-emerald-700', label: 'Visita' },
    note: { icon: FileText, color: 'bg-amber-100 text-amber-700', label: 'Anotação' },
    whatsapp: { icon: MessageSquare, color: 'bg-green-100 text-green-700', label: 'WhatsApp' },
}

function relativeTime(value: string) {
    try {
        return formatDistanceToNow(new Date(value), { addSuffix: true, locale: ptBR })
    } catch {
        return value
    }
}

interface Props {
    interactions: Interaction[]
}

export function ContactInteractionTimeline({ interactions }: Props) {
    if (interactions.length === 0) {
        return (
            <div className="rounded-md border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhuma interação registrada ainda. Use o botão acima para registrar ligações, e-mails e visitas.
            </div>
        )
    }

    return (
        <div className="relative space-y-1">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

            {interactions.map((item) => {
                const meta = TYPE_META[item.type] ?? TYPE_META['note']
                const Icon = meta.icon

                return (
                    <div key={item.id} className="flex gap-4 py-2 pl-1">
                        {/* Icon bubble */}
                        <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.color}`}>
                            <Icon className="h-3.5 w-3.5" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 rounded-lg border bg-card p-3 text-sm">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1">
                                <span className="font-medium">{meta.label}</span>
                                {item.direction === 'outbound' && (
                                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                                        <ArrowUpRight className="h-3 w-3" /> Saída
                                    </span>
                                )}
                                {item.direction === 'inbound' && (
                                    <span className="inline-flex items-center gap-1 text-xs text-sky-600">
                                        <ArrowDownLeft className="h-3 w-3" /> Entrada
                                    </span>
                                )}
                                <span className="ml-auto text-xs text-muted-foreground">
                                    {relativeTime(item.happened_at)}
                                </span>
                            </div>
                            <p className="text-muted-foreground leading-snug">{item.summary}</p>
                            {item.profiles?.full_name && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                    por {item.profiles.full_name}
                                </p>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
