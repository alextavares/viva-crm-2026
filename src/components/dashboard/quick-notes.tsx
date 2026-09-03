"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { StickyNote } from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"

export function QuickNotes() {
    const [note, setNote] = useState(() => {
        if (typeof window === "undefined") return ""
        return localStorage.getItem("imobi_quick_note") ?? ""
    })
    const debouncedNote = useDebounce(note, 1000)

    useEffect(() => {
        localStorage.setItem("imobi_quick_note", debouncedNote)
    }, [debouncedNote])

    return (
        <Card className="flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                    <StickyNote className="h-4 w-4 text-muted-foreground" />
                    Borrão de Notas
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
                <Textarea
                    placeholder="Digite suas anotações temporárias aqui..."
                    className="min-h-[120px] resize-none border-primary/10 bg-blue-50/30 dark:bg-blue-950/10 focus-visible:ring-1"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground mt-2 text-right">
                    Salvo automaticamente no navegador
                </p>
            </CardContent>
        </Card>
    )
}
