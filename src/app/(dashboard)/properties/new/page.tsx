import { PropertyForm } from '@/components/properties/property-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function NewPropertyPage() {
    return (
        <div className="max-w-4xl mx-auto py-8">
            <Card>
                <CardHeader>
                    <CardTitle>Novo Imóvel</CardTitle>
                    <CardDescription>
                        Cadastre um novo imóvel para venda ou locação.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <PropertyForm />
                </CardContent>
            </Card>
        </div>
    )
}
