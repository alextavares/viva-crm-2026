import { createClient } from '@/lib/supabase/server'
import { PropertyForm } from '@/components/properties/property-form'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function EditPropertyPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const supabase = await createClient()

    const { data: property, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single()

    if (error || !property) {
        console.error('Error fetching property:', error)
        notFound()
    }

    const { data: org } = await supabase
        .from('organizations')
        .select('slug')
        .eq('id', property.organization_id)
        .single()

    const publicUrl = org?.slug ? `/s/${org.slug}/imovel/${property.id}` : null

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-lg font-semibold md:text-2xl">Editar Imóvel</h1>
                <p className="text-muted-foreground">Atualize as informações do imóvel.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {publicUrl ? (
                    <Link href={publicUrl} target="_blank" rel="noreferrer">
                        <Button variant="outline">Abrir no site</Button>
                    </Link>
                ) : (
                    <Button variant="outline" disabled>
                        Abrir no site
                    </Button>
                )}
                <div className="text-xs text-muted-foreground">
                    Dica: se o imóvel estiver com <span className="font-medium">Ocultar do site</span>, ele não aparece no site público.
                </div>
            </div>

            <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
                <PropertyForm initialData={property} />
            </div>
        </div>
    )
}
