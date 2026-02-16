import { PropertyImportUniven } from "@/components/properties/property-import-univen"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function PropertyImportPage() {
  return (
    <div className="mx-auto max-w-4xl py-8">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold md:text-2xl">Importar imóveis</h1>
        <p className="text-muted-foreground">
          Traga seus imóveis de outro CRM. Importações entram ocultas do site por padrão, para você publicar depois.
        </p>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Univen (XML)</CardTitle>
          <CardDescription>
            Importe pelo export XML do seu CRM antigo: arquivo de imóveis + arquivo de fotos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PropertyImportUniven />
        </CardContent>
      </Card>
    </div>
  )
}

