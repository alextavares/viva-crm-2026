import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, User, Phone, Mail, Building } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ContactActions } from '@/components/contacts/contact-card-actions'
import { LeadsKanban } from '@/components/leads/leads-kanban'
import { LayoutGrid, Kanban } from 'lucide-react'

export default async function ContactsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const supabase = await createClient()
    const resolvedSearchParams = await searchParams
    const page = Number(resolvedSearchParams?.page) || 1
    const pageSize = Number(resolvedSearchParams?.pageSize) || 12
    const view = resolvedSearchParams?.view as string || 'list'
    const start = (page - 1) * pageSize
    const end = start + pageSize - 1

    let query = supabase
        .from('contacts')
        // Keep the select simple; relationship embedding can fail if the FK is missing/misconfigured
        // in the remote DB. The list/kanban doesn't need profile data to render.
        .select(`*`, { count: 'exact' })
        .order('created_at', { ascending: false })

    if (view === 'board') {
        // Fetch all (limit 1000) for Kanban
        query = query.range(0, 999)
    } else {
        query = query.range(start, end)
    }

    const { data: contacts, count, error } = await query

    if (error) {
        console.error('Error fetching contacts:', {
            message: (error as unknown as { message?: string }).message,
            details: (error as unknown as { details?: string }).details,
            hint: (error as unknown as { hint?: string }).hint,
            code: (error as unknown as { code?: string }).code,
        })
    }

    const totalPages = Math.ceil((count || 0) / pageSize)

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'lead': return 'Lead'
            case 'client': return 'Cliente'
            case 'owner': return 'Proprietário'
            case 'partner': return 'Parceiro'
            default: return type
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'new': return 'Novo'
            case 'contacted': return 'Contactado'
            case 'qualified': return 'Qualificado'
            case 'lost': return 'Perdido'
            case 'won': return 'Ganho'
            default: return status
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'new': return 'default'
            case 'qualified': return 'secondary'
            case 'won': return 'outline' // Green-ish ideally
            case 'lost': return 'destructive'
            default: return 'outline'
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold md:text-2xl">Contatos</h1>
                    <p className="text-muted-foreground">Gerencie seus leads e clientes.</p>
                </div>
                <Link href="/contacts/new">
                    <Button className="w-full sm:w-auto">
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Contato
                    </Button>
                </Link>
            </div>

            <div className="flex items-center justify-end">
                <div className="flex bg-muted rounded-lg p-1">
                    <Link href="/contacts?view=list">
                        <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-2">
                            <LayoutGrid className="h-4 w-4" />
                            Lista
                        </Button>
                    </Link>
                    <Link href="/contacts?view=board">
                        <Button variant={view === 'board' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-2">
                            <Kanban className="h-4 w-4" />
                            Kanban
                        </Button>
                    </Link>
                </div>
            </div>

            {view === 'board' ? (
                <LeadsKanban initialData={contacts || []} />
            ) : (
                (!contacts || contacts.length === 0) ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center border rounded-lg bg-muted/20 border-dashed">
                        <User className="h-10 w-10 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold">Nenhum contato encontrado</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mb-4">
                            Comece adicionando leads, proprietários ou clientes.
                        </p>
                        {count === 0 && (
                            <Link href="/contacts/new">
                                <Button variant="outline">Cadastrar Primeiro Contato</Button>
                            </Link>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {contacts.map((contact) => (
                                <div key={contact.id} className="relative group">
                                    <Link href={`/contacts/${contact.id}`}>
                                        <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                                            <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                                                <Avatar>
                                                    <AvatarImage src={`https://ui-avatars.com/api/?name=${contact.name}&background=random`} />
                                                    <AvatarFallback>{contact.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <CardTitle className="text-base">{contact.name}</CardTitle>
                                                    <p className="text-xs text-muted-foreground">{getTypeLabel(contact.type)}</p>
                                                </div>
                                                <Badge variant={getStatusColor(contact.status) as "default" | "secondary" | "destructive" | "outline"} className="ml-auto">
                                                    {getStatusLabel(contact.status)}
                                                </Badge>
                                            </CardHeader>
                                            <CardContent className="grid gap-2 text-sm">
                                                {contact.email && (
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <Mail className="h-4 w-4" />
                                                        <span className="truncate">{contact.email}</span>
                                                    </div>
                                                )}
                                                {contact.phone && (
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <Phone className="h-4 w-4" />
                                                        <span>{contact.phone}</span>
                                                    </div>
                                                )}
                                                {contact.organization_id && (
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2 pt-2 border-t">
                                                        <Building className="h-3 w-3" />
                                                        <span>Organização</span>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </Link>
                                    <ContactActions contactId={contact.id} />
                                </div>
                            ))}
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-end gap-2 mt-4">
                                <Link href={`/contacts?page=${page - 1}&pageSize=${pageSize}`} className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
                                    <Button variant="outline" size="sm" disabled={page <= 1}>Anterior</Button>
                                </Link>
                                <span className="text-sm text-muted-foreground">
                                    Página {page} de {totalPages}
                                </span>
                                <Link href={`/contacts?page=${page + 1}&pageSize=${pageSize}`} className={page >= totalPages ? "pointer-events-none opacity-50" : ""}>
                                    <Button variant="outline" size="sm" disabled={page >= totalPages}>Próxima</Button>
                                </Link>
                            </div>
                        )}
                    </>
                )
            )}
        </div>
    )
}
