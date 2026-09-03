'use client'

import React, { useState, useMemo } from 'react'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
    defaultDropAnimationSideEffects,
    DropAnimation,
    useDroppable,
} from '@dnd-kit/core'
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
    buildSlaBadge,
    getTypeLabel,
    type EnrichedContactRow,
    type LeadDistributionSettings,
} from '@/components/contacts/contacts-grid'
import { useRouter } from 'next/navigation'
import { KANBAN_COLUMNS } from '@/lib/types'
import { GripVertical, Mail, Phone } from 'lucide-react'
import { updateContactStatus } from '@/app/actions/contacts'

interface LeadsKanbanProps {
    initialData: EnrichedContactRow[]
    leadDistributionSettings: LeadDistributionSettings
    itemLabel?: string
    shouldRefreshOnSuccess?: boolean
}

function getSortTimestamp(value: string | null | undefined) {
    if (!value) return 0
    const ts = new Date(value).getTime()
    return Number.isFinite(ts) ? ts : 0
}

export function LeadsKanban({
    initialData,
    leadDistributionSettings,
    itemLabel = 'lead',
    shouldRefreshOnSuccess = true,
}: LeadsKanbanProps) {
    const [contacts, setContacts] = useState<EnrichedContactRow[]>(initialData)
    const [activeId, setActiveId] = useState<string | null>(null)
    const router = useRouter()

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const columns = useMemo(() => {
        const cols: Record<string, EnrichedContactRow[]> = {}
        KANBAN_COLUMNS.forEach(col => {
            cols[col.id] = contacts
                .filter(c => c.status === col.id)
                .sort((a, b) => {
                    if (col.id === 'new') {
                        return getSortTimestamp(a.latestLeadAt || a.created_at) - getSortTimestamp(b.latestLeadAt || b.created_at)
                    }

                    return getSortTimestamp(b.updated_at || b.created_at) - getSortTimestamp(a.updated_at || a.created_at)
                })
        })
        return cols
    }, [contacts])

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string)
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event

        if (!over) {
            setActiveId(null)
            return
        }

        const activeId = active.id as string
        const overId = over.id as string

        // Find the container (column) for the active item
        const activeContainer = contacts.find(c => c.id === activeId)?.status
        // Find the container (column) for the over item
        let overContainer = KANBAN_COLUMNS.find(c => c.id === overId)?.id
        if (!overContainer) {
            overContainer = contacts.find(c => c.id === overId)?.status
        }

        if (!activeContainer || !overContainer || activeContainer === overContainer) {
            setActiveId(null)
            return
        }

        const targetColumnTitle =
            KANBAN_COLUMNS.find((column) => column.id === overContainer)?.title || 'nova etapa'

        // Optimistic update
        const previousContacts = [...contacts]
        const updatedContacts = contacts.map(c =>
            c.id === activeId ? { ...c, status: overContainer! } : c
        )
        setContacts(updatedContacts)
        setActiveId(null)

        const result = await updateContactStatus(activeId, overContainer)
        if (!result.success) {
            toast.error(result.error)
            setContacts(previousContacts)
            return
        }

        toast.success(`Lead movido para ${targetColumnTitle}.`)
        if (shouldRefreshOnSuccess) {
            router.refresh()
        }
    }

    const dropAnimation: DropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: {
                    opacity: '0.5',
                },
            },
        }),
    }

    const activeItem = activeId ? contacts.find(c => c.id === activeId) : null

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div data-testid="kanban-root" className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-200px)]">
                {KANBAN_COLUMNS.map((col) => (
                    <KanbanColumn
                        key={col.id}
                        id={col.id}
                        title={col.title}
                        contacts={columns[col.id] || []}
                        leadDistributionSettings={leadDistributionSettings}
                        itemLabel={itemLabel}
                    />
                ))}
            </div>

            <DragOverlay dropAnimation={dropAnimation}>
                {activeItem ? (
                    <KanbanCard
                        contact={activeItem}
                        leadDistributionSettings={leadDistributionSettings}
                        isOverlay
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    )
}

function getColumnHint(columnId: string) {
    switch (columnId) {
        case 'new':
            return 'Primeiro contato · mais antigos primeiro'
        case 'contacted':
            return 'Em atendimento'
        case 'qualified':
            return 'Perfil validado'
        case 'lost':
            return 'Sem avanço'
        case 'won':
            return 'Oportunidade fechada'
        default:
            return null
    }
}

function getColumnEmptyState(columnId: string, itemLabel: string) {
    switch (columnId) {
        case 'new':
            return `Nenhum ${itemLabel} novo. Arraste um ${itemLabel} para iniciar o atendimento.`
        case 'contacted':
            return `Nenhum ${itemLabel} em atendimento. Arraste um ${itemLabel} para esta etapa.`
        case 'qualified':
            return `Nenhum ${itemLabel} qualificado. Arraste um ${itemLabel} para esta etapa.`
        case 'lost':
            return `Nenhum ${itemLabel} perdido. Arraste um ${itemLabel} para esta etapa.`
        case 'won':
            return `Nenhum ${itemLabel} ganho. Arraste um ${itemLabel} para esta etapa.`
        default:
            return `Arraste um ${itemLabel} para esta etapa.`
    }
}

function KanbanColumn({
    id,
    title,
    contacts,
    leadDistributionSettings,
    itemLabel,
}: {
    id: string
    title: string
    contacts: EnrichedContactRow[]
    leadDistributionSettings: LeadDistributionSettings
    itemLabel: string
}) {
    const { setNodeRef } = useDroppable({
        id: id,
    })
    const pluralItemLabel = itemLabel === 'lead' ? 'leads' : 'contatos'
    const contactCountLabel = `${contacts.length} ${contacts.length === 1 ? itemLabel : pluralItemLabel}`
    const columnHint = getColumnHint(id)
    const emptyStateMessage = getColumnEmptyState(id, itemLabel)

    return (
        <div ref={setNodeRef} data-testid={`kanban-column-${id}`} className="min-w-[300px] bg-muted/30 rounded-lg p-4 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
                <div className="min-w-0">
                    <h3 className="font-semibold text-sm">{title}</h3>
                    {columnHint ? (
                        <p className="text-[11px] text-muted-foreground">{columnHint}</p>
                    ) : null}
                </div>
                <Badge variant="secondary" className="text-xs">
                    {contactCountLabel}
                </Badge>
            </div>

            <SortableContext
                id={id}
                items={contacts.map(c => c.id)}
                strategy={rectSortingStrategy}
            >
                <div className="flex-1 space-y-3 overflow-y-auto pr-2">
                    {contacts.map((contact) => (
                        <KanbanCard
                            key={contact.id}
                            contact={contact}
                            leadDistributionSettings={leadDistributionSettings}
                        />
                    ))}
                    {contacts.length === 0 && (
                        <div className="h-20 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground text-xs">
                            {emptyStateMessage}
                        </div>
                    )}
                </div>
            </SortableContext>
        </div>
    )
}

function KanbanCard({
    contact,
    leadDistributionSettings,
    isOverlay,
}: {
    contact: EnrichedContactRow
    leadDistributionSettings: LeadDistributionSettings
    isOverlay?: boolean
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: contact.id,
        data: {
            type: 'Contact',
            contact,
        },
    })

    const router = useRouter()
    const slaBadge = buildSlaBadge(contact.latestLeadAt || null, contact.status, leadDistributionSettings)

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            data-testid={`kanban-card-${contact.id}`}
            className={isOverlay ? 'cursor-grabbing scale-105 rotate-2 shadow-xl' : ''}
        >
            <Card
                className="bg-background border shadow-sm hover:shadow-md transition-all cursor-pointer"
                onClick={() => {
                    if (!isDragging) {
                        router.push(`/contacts/${contact.id}`)
                    }
                }}
            >
                <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Avatar className="h-8 w-8 shrink-0">
                                <AvatarImage src={`https://ui-avatars.com/api/?name=${contact.name}&background=random`} />
                                <AvatarFallback className="text-xs">{contact.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                                <h4 className="font-medium text-sm line-clamp-1">{contact.name}</h4>
                                <p className="text-xs text-muted-foreground">{getTypeLabel(contact.type)}</p>
                                {slaBadge ? (
                                    <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${slaBadge.className}`}>
                                        SLA: {slaBadge.label} ({slaBadge.elapsed})
                                    </span>
                                ) : null}
                            </div>
                        </div>
                        {/* Drag handle — only this area triggers drag */}
                        <button
                            {...listeners}
                            className="touch-none cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted text-muted-foreground shrink-0"
                            aria-label="Arrastar contato"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <GripVertical className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="space-y-1 border-t pt-1 text-xs text-muted-foreground">
                        <div className={`flex items-center gap-1.5 truncate ${contact.email ? '' : 'italic'}`}>
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{contact.email || 'Sem email'}</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${contact.phone ? '' : 'italic'}`}>
                            <Phone className="h-3 w-3 shrink-0" />
                            <span>{contact.phone || 'Sem telefone'}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
