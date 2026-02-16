import { PropertyBulkPublish } from "@/components/properties/property-bulk-publish"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function PropertyPublishPage() {
  return (
    <div className="mx-auto max-w-6xl py-8">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold md:text-2xl">Publicação em massa</h1>
        <p className="text-muted-foreground">
          Imóveis importados entram ocultos do site por padrão. Aqui você publica vários de uma vez, com segurança.
        </p>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Selecionar e publicar</CardTitle>
          <CardDescription>
            Dica: comece pelos <span className="font-medium">Disponíveis</span> e <span className="font-medium">Ocultos</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PropertyBulkPublish />
        </CardContent>
      </Card>
    </div>
  )
}

