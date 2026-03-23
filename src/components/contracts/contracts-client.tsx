"use client"

import { useState } from "react"
import { Plus, Pencil } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { ContractForm } from "./contract-form"

export function ContractsClient({
    initialData,
    organizationId,
    role
}: {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    initialData: any[],
    organizationId: string,
    role: string
}) {
    const [contracts] = useState(initialData)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const [editingContract, setEditingContract] = useState<any | null>(null)
    const canEdit = role === "owner" || role === "manager"

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    Mostrando <strong>{contracts.length}</strong> contratos arquivados ou ativos.
                </p>
                {canEdit && (
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Novo Contrato
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Novo Contrato</DialogTitle>
                                <DialogDescription>
                                    Arquive um novo contrato de venda ou locação para o sistema.
                                </DialogDescription>
                            </DialogHeader>
                            <ContractForm
                                organizationId={organizationId}
                                onSuccess={() => setIsCreateOpen(false)}
                                onCancel={() => setIsCreateOpen(false)}
                            />
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead className="hidden md:table-cell">Tipo</TableHead>
                            <TableHead>Imóvel</TableHead>
                            <TableHead className="hidden sm:table-cell">Cliente</TableHead>
                            <TableHead className="hidden lg:table-cell">Corretor</TableHead>
                            <TableHead className="text-right">Valor Final</TableHead>
                            <TableHead className="text-right hidden md:table-cell">Comissão</TableHead>
                            <TableHead className="text-right hidden sm:table-cell">Início</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {contracts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center">
                                    Nenhum contrato encontrado.
                                </TableCell>
                            </TableRow>
                        ) : (
                            contracts.map((contract) => (
                                <TableRow key={contract.id}>
                                    <TableCell>
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${contract.status === 'active' ? 'bg-green-100 text-green-700' :
                                            contract.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                                                contract.status === 'canceled' ? 'bg-red-100 text-red-700' :
                                                    'bg-amber-100 text-amber-800'
                                            }`}>
                                            {contract.status === 'active' ? 'Ativo' :
                                                contract.status === 'completed' ? 'Concluído' :
                                                    contract.status === 'canceled' ? 'Cancelado' :
                                                        'Rascunho'}
                                        </span>
                                        {contract.status === 'draft' && contract.proposal_id && (
                                            <div className="text-[10px] text-muted-foreground mt-1 whitespace-nowrap">
                                                Originado de proposta
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell capitalize">
                                        {contract.contract_type === 'sale' ? 'Venda' : 'Locação'}
                                    </TableCell>
                                    <TableCell className="font-medium max-w-[150px] sm:max-w-[200px] truncate">
                                        {contract.properties?.public_code ? `[${contract.properties.public_code}] ` : ''}
                                        {contract.properties?.title || 'N/A'}
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell truncate max-w-[150px]">
                                        {contract.contacts?.name || 'N/A'}
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                        {contract.profiles?.full_name || 'N/A'}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contract.final_value)}
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground hidden md:table-cell">
                                        {contract.commission_value ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contract.commission_value) : '-'}
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground text-sm hidden sm:table-cell">
                                        {contract.start_date ? format(new Date(contract.start_date), "dd/MM/yyyy", { locale: ptBR }) : '-'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {canEdit && (
                                            <Dialog
                                                open={editingContract?.id === contract.id}
                                                onOpenChange={(open) => {
                                                    if (!open) setEditingContract(null)
                                                }}
                                            >
                                                <DialogTrigger asChild>
                                                    {contract.status === 'draft' ? (
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            className="h-8 shadow-sm"
                                                            onClick={() => setEditingContract(contract)}
                                                        >
                                                            {contract.proposal_id ? 'Revisar rascunho' : 'Continuar'}
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setEditingContract(contract)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </DialogTrigger>
                                                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                                                    <DialogHeader>
                                                        <DialogTitle>Editar Contrato</DialogTitle>
                                                        <DialogDescription>
                                                            Atualize os dados do contrato.
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <ContractForm
                                                        organizationId={organizationId}
                                                        initialData={contract}
                                                        onSuccess={() => setEditingContract(null)}
                                                        onCancel={() => setEditingContract(null)}
                                                    />
                                                </DialogContent>
                                            </Dialog>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
