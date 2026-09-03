import { PropertyImportUniven } from "@/components/properties/property-import-univen"
import { PropertyImportCsv } from "@/components/properties/property-import-csv"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function PropertyImportPage() {
  return (
    <div className="mx-auto max-w-4xl py-8">
      <div className="space-y-2 px-4 md:px-0">
        <h1 className="text-xl font-semibold md:text-2xl">Importar imóveis</h1>
        <p className="text-muted-foreground">
          Traga seus imóveis de outro CRM. Importações entram ocultas do site por padrão.
        </p>
      </div>

      <Tabs defaultValue="univen" className="mt-8">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="univen">Univen (XML)</TabsTrigger>
          <TabsTrigger value="csv">Planilha (CSV)</TabsTrigger>
        </TabsList>

        <TabsContent value="univen" className="mt-6 data-[state=inactive]:hidden" forceMount>
          <Card>
            <CardHeader>
              <CardTitle>Univen (XML)</CardTitle>
              <CardDescription>
                Importe pelo export XML do seu CRM antigo: imóveis + fotos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PropertyImportUniven />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="csv" className="mt-6 data-[state=inactive]:hidden" forceMount>
          <Card>
            <CardHeader>
              <CardTitle>Planilha (CSV)</CardTitle>
              <CardDescription>
                Importe a partir de um arquivo CSV exportado de planilhas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PropertyImportCsv />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

