import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function AuthCodeError() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
            <Card className="w-full max-w-md border-destructive/50">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                            <AlertCircle className="h-6 w-6 text-destructive" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-destructive">Erro de Autenticação</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground">
                    <p>
                        Ocorreu um problema ao validar seu login com o provedor externo.
                    </p>
                    <p className="mt-2 text-sm">
                        O código de autorização pode ter expirado ou verifique sua conexão.
                    </p>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Link href="/login">
                        <Button variant="default">Voltar para o Login</Button>
                    </Link>
                </CardFooter>
            </Card>
        </div>
    )
}
