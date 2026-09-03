import { createClient } from '@/lib/supabase/server'
import { PropertyForm } from '@/components/properties/property-form'
import { PropertyRecordSummary } from '@/components/properties/property-record-summary'
import { getPropertyVitrineStatus } from '@/lib/property-vitrine-status'
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
        .select(`
            *,
            owner_contact:contacts!properties_owner_contact_id_fkey(id, name),
            broker:profiles(full_name)
        `)
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

    const organizationSlug = org?.slug ?? null
    const publicUrl = organizationSlug ? `/s/${organizationSlug}/imovel/${property.id}` : null
    const publicListUrl = organizationSlug ? `/s/${organizationSlug}` : null
    const vitrine = getPropertyVitrineStatus(property)
    const canOpenOnSite = Boolean(publicUrl && vitrine.canOpenPublicLink)

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-lg font-semibold md:text-2xl">Editar Imóvel</h1>
                <p className="text-muted-foreground">Atualize as informações do imóvel.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {publicListUrl ? (
                    <Link href={publicListUrl} target="_blank" rel="noreferrer">
                        <Button variant="outline">Abrir vitrine</Button>
                    </Link>
                ) : null}
                {publicUrl && canOpenOnSite ? (
                    <Link href={publicUrl} target="_blank" rel="noreferrer">
                        <Button variant="outline">Conferir imóvel no site</Button>
                    </Link>
                ) : (
                    <Button variant="outline" disabled>
                        Link público indisponível
                    </Button>
                )}
                <div className="text-xs text-muted-foreground">
                    O link público só abre quando o imóvel está <span className="font-medium">disponível</span>, com <span className="font-medium">site liberado</span> e sem bloqueios de vitrine.
                </div>
                <div className="text-xs text-muted-foreground">
                    Referência pública: <span className="font-medium">{property.public_code || property.id.slice(0, 8)}</span>
                </div>
            </div>

            <div className="space-y-6">
                <PropertyRecordSummary property={property} organizationSlug={organizationSlug} />
                <PropertyForm initialData={property} />
            </div>
        </div>
    )
}
