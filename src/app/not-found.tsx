import Link from 'next/link'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
                <FileQuestion className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
                Página não encontrada
            </h2>
            <p className="text-muted-foreground max-w-md mb-6">
                A página que você está procurando não existe ou foi movida.
            </p>
            <Link href="/dashboard">
                <Button variant="outline">
                    Voltar ao Dashboard
                </Button>
            </Link>
        </div>
    )
}
