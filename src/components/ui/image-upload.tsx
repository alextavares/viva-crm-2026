'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ImagePlus, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { createMediaUploadPath, resolveMediaUrl, uploadPublicMedia } from '@/lib/media'

interface ImageUploadProps {
    value?: string[]
    onChange: (value: string[]) => void
    disabled?: boolean
    organizationId?: string | null
}

export function ImageUpload({ value = [], onChange, disabled, organizationId }: ImageUploadProps) {
    const [isUploading, setIsUploading] = useState(false)
    const supabase = createClient()
    const uploadDisabled = disabled || isUploading || !organizationId

    const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const files = e.target.files
            if (!files || files.length === 0) return
            if (!organizationId) {
                toast.error('Organização não carregada. Tente novamente em instantes.')
                return
            }

            setIsUploading(true)
            const newUrls: string[] = []

            for (const file of Array.from(files)) {
                const fileExt = file.name.split('.').pop()
                const filePath = createMediaUploadPath({
                    organizationId,
                    scope: 'properties',
                    extension: fileExt,
                    kind: 'image',
                })

                const { publicUrl } = await uploadPublicMedia({
                    supabase,
                    bucket: 'properties',
                    path: filePath,
                    file,
                    upsert: true,
                    cacheControl: '3600',
                })

                newUrls.push(publicUrl)
            }

            onChange([...value, ...newUrls])
        } catch (error) {
            console.error('Error uploading image:', error)
            toast.error('Erro ao fazer upload da imagem.')
        } finally {
            // Allow re-selecting the same file(s) again.
            e.target.value = ''
            setIsUploading(false)
        }
    }

    const onRemove = (url: string) => {
        onChange(value.filter((current) => current !== url))
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
                    {value.length} foto(s)
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {value.map((url) => (
                    <div key={url} className="relative aspect-square rounded-lg overflow-hidden border">
                        <div className="absolute top-2 right-2 z-10">
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
                        {/* Avoid next/image remote domain config for Supabase public URLs */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={resolveMediaUrl(url) ?? url} alt="Property Image" className="h-full w-full object-cover" />
                    </div>
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
                    </div>
                </div>
            </div>
        </div>
    )
}
