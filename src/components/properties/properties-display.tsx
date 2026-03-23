"use client"

import { useState, useEffect } from "react"
import { PropertiesGrid, type PropertyListRow } from "@/components/properties/properties-grid"
import { PropertiesList } from "@/components/properties/properties-list"
import { LayoutGrid, List } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

// Fallback to local storage to remember the user's preference
const PREFERRED_VIEW_KEY = "property_list_view_preference"

type ViewMode = "list" | "grid"

interface PropertiesDisplayProps {
    properties: PropertyListRow[]
}

export function PropertiesDisplay({ properties }: PropertiesDisplayProps) {
    const [viewMode, setViewMode] = useState<ViewMode>("list")

    useEffect(() => {
        const saved = localStorage.getItem(PREFERRED_VIEW_KEY) as ViewMode | null
        if (saved === "grid") {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setViewMode(saved)
        }
    }, [])

    const handleViewChange = (value: string) => {
        if (!value) return // Prevent deselecting
        const newMode = value as ViewMode
        setViewMode(newMode)
        localStorage.setItem(PREFERRED_VIEW_KEY, newMode)
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground font-medium">
                    Exibindo <span className="text-foreground">{properties.length}</span> imóveis nesta página
                </div>
                <ToggleGroup 
                    type="single" 
                    value={viewMode} 
                    onValueChange={handleViewChange}
                    className="border rounded-md p-1 bg-muted/20"
                >
                    <ToggleGroupItem value="list" aria-label="Modo lista" className="h-8 px-2 text-xs">
                        <List className="h-4 w-4 mr-1.5" />
                        Lista
                    </ToggleGroupItem>
                    <ToggleGroupItem value="grid" aria-label="Modo cards" className="h-8 px-2 text-xs">
                        <LayoutGrid className="h-4 w-4 mr-1.5" />
                        Cards
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>

            {viewMode === "list" ? (
                <PropertiesList properties={properties} />
            ) : (
                <PropertiesGrid properties={properties} />
            )}
        </div>
    )
}
