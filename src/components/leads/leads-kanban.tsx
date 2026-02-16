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
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
import { type Contact, KANBAN_COLUMNS } from '@/lib/types'

interface LeadsKanbanProps {
    initialData: Contact[]
    shouldRefreshOnSuccess?: boolean
}

export function LeadsKanban({ initialData, shouldRefreshOnSuccess = true }: LeadsKanbanProps) {
    const [contacts, setContacts] = useState<Contact[]>(initialData)
    const [activeId, setActiveId] = useState<string | null>(null)
    const supabase = createClient()
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
        const cols: Record<string, Contact[]> = {}
        KANBAN_COLUMNS.forEach(col => {
            cols[col.id] = contacts.filter(c => c.status === col.id)
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

        // Optimistic update
        const previousContacts = [...contacts]
        const updatedContacts = contacts.map(c =>
            c.id === activeId ? { ...c, status: overContainer! } : c
        )
        setContacts(updatedContacts)
        setActiveId(null)

        // API update
        try {
            const { error } = await supabase
                .from('contacts')
                .update({ status: overContainer })
                .eq('id', activeId)

            if (error) throw error

            toast.success('Status atualizado com sucesso!')
            if (shouldRefreshOnSuccess) {
                router.refresh()
            }
        } catch (error) {
            console.error('Error updating status:', error)
            toast.error('Erro ao atualizar status. Desfazendo alterações.')
            // Revert on error
            setContacts(previousContacts)
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
                    />
                ))}
            </div>

            <DragOverlay dropAnimation={dropAnimation}>
                {activeItem ? <KanbanCard contact={activeItem} isOverlay /> : null}
            </DragOverlay>
        </DndContext>
    )
}

function KanbanColumn({ id, title, contacts }: { id: string, title: string, contacts: Contact[] }) {
    const { setNodeRef } = useDroppable({
        id: id,
    })

    return (
        <div ref={setNodeRef} data-testid={`kanban-column-${id}`} className="min-w-[300px] bg-muted/30 rounded-lg p-4 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm">{title}</h3>
                <Badge variant="secondary" className="text-xs">
                    {contacts.length}
                </Badge>
            </div>

            <SortableContext
                id={id}
                items={contacts.map(c => c.id)}
                strategy={rectSortingStrategy}
            >
                <div className="flex-1 space-y-3 overflow-y-auto pr-2">
                    {contacts.map((contact) => (
                        <KanbanCard key={contact.id} contact={contact} />
                    ))}
                    {contacts.length === 0 && (
                        <div className="h-20 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground text-xs">
                            Arraste aqui
                        </div>
                    )}
                </div>
            </SortableContext>
        </div>
    )
}

function KanbanCard({ contact, isOverlay }: { contact: Contact; isOverlay?: boolean }) {
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
            {...listeners}
            data-testid={`kanban-card-${contact.id}`}
            className={`touch-none ${isOverlay ? 'cursor-grabbing scale-105 rotate-2 shadow-xl' : 'cursor-grab'}`}
        >
            <Card className="bg-background border shadow-sm hover:shadow-md transition-all">
                <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={`https://ui-avatars.com/api/?name=${contact.name}&background=random`} />
                                <AvatarFallback className="text-xs">{contact.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                                <h4 className="font-medium text-sm line-clamp-1">{contact.name}</h4>
                                <p className="text-xs text-muted-foreground capitalize">{contact.type}</p>
                            </div>
                        </div>
                    </div>

                    {(contact.email || contact.phone) && (
                        <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t">
                            {contact.email && <div className="truncate">{contact.email}</div>}
                            {contact.phone && <div>{contact.phone}</div>}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
