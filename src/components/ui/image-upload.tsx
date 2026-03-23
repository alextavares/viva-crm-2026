'use client'

import { useState } from 'react'
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, rectSortingStrategy, sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ImagePlus, X, Loader2, Star, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { createMediaUploadPath, resolveMediaUrl, uploadPublicMedia } from '@/lib/media'

interface ImageUploadProps {
    value?: string[]
    onChange: (value: string[]) => void
    disabled?: boolean
    organizationId?: string | null
}

interface UploadStatus {
    total: number
    completed: number
    currentFileName: string | null
}

interface SortableImageCardProps {
    url: string
    index: number
    uploadDisabled: boolean
    onMakePrimary: (url: string) => void
    onRemove: (url: string) => void
}

const IMAGE_UPLOAD_TIMEOUT_MS = 120_000

function SortableImageCard({
    url,
    index,
    uploadDisabled,
    onMakePrimary,
    onRemove,
}: SortableImageCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: url, disabled: uploadDisabled })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "relative aspect-square rounded-lg overflow-hidden border bg-background",
                isDragging && "z-20 shadow-xl ring-2 ring-primary/30 opacity-90"
            )}
        >
            <div className="absolute top-2 left-2 z-10 flex items-start gap-2">
                {index === 0 ? (
                    <div className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-medium text-white shadow-sm">
                        <Star className="h-3 w-3 fill-current" />
                        Principal
                    </div>
                ) : (
                    <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        onClick={() => onMakePrimary(url)}
                        disabled={uploadDisabled}
                        className="shadow-sm"
                    >
                        <Star className="h-3 w-3" />
                        Definir principal
                    </Button>
                )}
            </div>
            <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="h-7 bg-background/95 shadow-sm cursor-grab active:cursor-grabbing"
                    disabled={uploadDisabled}
                    title="Arrastar para reordenar"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="h-3 w-3" />
                    Arrastar
                </Button>
                <Button
                    type="button"
                    onClick={() => onRemove(url)}
                    variant="destructive"
                    size="icon"
                    className="h-6 w-6"
                >
                    <X className="h-3 w-3" />
                </Button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolveMediaUrl(url) ?? url} alt="Property Image" className="h-full w-full object-cover" />
        </div>
    )
}

export function ImageUpload({ value = [], onChange, disabled, organizationId }: ImageUploadProps) {
    const [isUploading, setIsUploading] = useState(false)
    const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
        total: 0,
        completed: 0,
        currentFileName: null,
    })
    const supabase = createClient()
    const uploadDisabled = disabled || isUploading
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 6,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    async function withTimeout<T>(promise: Promise<T>, ms = IMAGE_UPLOAD_TIMEOUT_MS): Promise<T> {
        let timeoutId: ReturnType<typeof setTimeout> | null = null
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
                const err = new Error("UploadTimeout")
                err.name = "TimeoutError"
                reject(err)
            }, ms)
        })

        try {
            return await Promise.race([promise, timeoutPromise])
        } finally {
            if (timeoutId) clearTimeout(timeoutId)
        }
    }

    const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const files = e.target.files
            if (!files || files.length === 0) return
            if (!organizationId) {
                toast.error('Organização não carregada. Tente novamente em instantes.')
                return
            }

            setIsUploading(true)
            const nextUrls = [...value]
            const fileList = Array.from(files)
            setUploadStatus({
                total: fileList.length,
                completed: 0,
                currentFileName: fileList[0]?.name ?? null,
            })

            for (const [index, file] of fileList.entries()) {
                setUploadStatus({
                    total: fileList.length,
                    completed: index,
                    currentFileName: file.name,
                })
                const fileExt = file.name.split('.').pop()
                const filePath = createMediaUploadPath({
                    organizationId,
                    scope: 'properties',
                    extension: fileExt,
                    kind: 'image',
                })

                const { publicUrl } = await withTimeout(
                    uploadPublicMedia({
                        supabase,
                        bucket: 'properties',
                        path: filePath,
                        file,
                        upsert: true,
                        cacheControl: '3600',
                    })
                )

                nextUrls.push(publicUrl)
                onChange([...nextUrls])
            }
            setUploadStatus({
                total: fileList.length,
                completed: fileList.length,
                currentFileName: null,
            })
            toast.success(
                fileList.length === 1
                    ? "Foto enviada com sucesso."
                    : `${fileList.length} fotos enviadas com sucesso.`
            )
        } catch (error) {
            console.error('Error uploading image:', error)
            const isTimeout =
                typeof error === 'object' &&
                error !== null &&
                'name' in error &&
                (error as { name?: unknown }).name === 'TimeoutError'
            const fileLabel = uploadStatus.currentFileName ? ` (${uploadStatus.currentFileName})` : ''
            toast.error(
                isTimeout
                    ? `Upload demorou demais${fileLabel}. Tente de novo com menos fotos por vez.`
                    : `Erro ao fazer upload da imagem${fileLabel}.`
            )
        } finally {
            // Allow re-selecting the same file(s) again.
            e.target.value = ''
            setIsUploading(false)
            setUploadStatus((current) => ({
                total: current.total,
                completed: current.completed,
                currentFileName: null,
            }))
        }
    }

    const onRemove = (url: string) => {
        onChange(value.filter((current) => current !== url))
    }

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const oldIndex = value.findIndex((current) => current === active.id)
        const newIndex = value.findIndex((current) => current === over.id)
        if (oldIndex < 0 || newIndex < 0) return

        onChange(arrayMove(value, oldIndex, newIndex))
    }

    const onMakePrimary = (url: string) => {
        if (disabled || isUploading) return
        if (!value.includes(url) || value[0] === url) return

        const next = [url, ...value.filter((current) => current !== url)]
        onChange(next)
        toast.success('Foto principal atualizada.')
    }

    const onRemoveAll = () => {
        if (disabled || isUploading) return
        if (value.length === 0) return
        const ok = window.confirm(`Remover todas as ${value.length} fotos deste imóvel?`)
        if (!ok) return
        onChange([])
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                    {isUploading
                        ? `${value.length} foto(s) no imóvel · ${uploadStatus.completed}/${uploadStatus.total} enviadas`
                        : `${value.length} foto(s)`}
                </div>
                <div className="text-[11px] text-muted-foreground">
                    A primeira foto é a capa do imóvel.
                </div>
                {value.length > 0 ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onRemoveAll}
                        disabled={uploadDisabled}
                    >
                        Remover todas
                    </Button>
                ) : null}
            </div>
            {isUploading ? (
                <div className="rounded-md border bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <div className="font-medium">
                        Enviando {uploadStatus.completed + 1} de {uploadStatus.total}
                    </div>
                    {uploadStatus.currentFileName ? (
                        <div className="truncate">
                            Arquivo atual: {uploadStatus.currentFileName}
                        </div>
                    ) : null}
                    <div className="text-amber-700/90">
                        As miniaturas aparecem conforme cada foto conclui.
                    </div>
                </div>
            ) : null}
            {value.length > 1 ? (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Use o botão <span className="font-medium text-foreground">Arrastar</span> em cada foto para reordenar a exibição.
                </div>
            ) : null}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={value} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {value.map((url, index) => (
                            <SortableImageCard
                                key={url}
                                url={url}
                                index={index}
                                uploadDisabled={uploadDisabled}
                                onMakePrimary={onMakePrimary}
                                onRemove={onRemove}
                            />
                        ))}

                        <div className="relative aspect-square flex items-center justify-center border-dashed border-2 rounded-lg hover:bg-muted/50 transition cursor-pointer">
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                className={cn(
                                    "absolute inset-0 w-full h-full opacity-0 cursor-pointer",
                                    uploadDisabled && "pointer-events-none"
                                )}
                                onChange={onUpload}
                                disabled={uploadDisabled}
                            />
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                {isUploading ? (
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                ) : (
                                    <ImagePlus className="h-8 w-8" />
                                )}
                                <span className="text-xs font-medium">
                                    {isUploading ? 'Enviando...' : 'Adicionar Fotos'}
                                </span>
                                {!organizationId ? (
                                    <span className="text-[10px] text-amber-700 text-center px-3">
                                        Aguardando organização para liberar o upload.
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    )
}
