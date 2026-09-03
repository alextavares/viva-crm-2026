import { PropertyForm } from '@/components/properties/property-form'

export default function NewPropertyPage() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-lg font-semibold md:text-2xl">Novo imóvel</h1>
                <p className="text-sm text-muted-foreground">
                    Cadastre os dados essenciais, proprietário, fotos e publicação sem sair do fluxo.
                </p>
            </div>
            <PropertyForm />
        </div>
    )
}
