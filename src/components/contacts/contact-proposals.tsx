"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus, FileCheck2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DealProposal } from "@/lib/types"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { ProposalForm } from "./proposal-form"

type ContractRef = { contractId: string; contractStatus: string }

interface ContactProposalsProps {
    contactId: string
    organizationId: string
    brokerId?: string | null
    initialProposals: DealProposal[]
    proposalContractMap?: Map<string, ContractRef>
    canEdit?: boolean
}

export function ContactProposals({
    contactId,
    organizationId,
    brokerId,
    initialProposals,
    proposalContractMap = new Map(),
    canEdit = false,
}: ContactProposalsProps) {
    const [proposals] = useState<DealProposal[]>(initialProposals)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [editingProposal, setEditingProposal] = useState<DealProposal | null>(null)

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-base font-semibold">Propostas Comerciais</h2>
                    <p className="text-sm text-muted-foreground">
                        Gerencie as negociações ativas com este cliente.
                    </p>
                </div>

                {canEdit && (
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm">
                                <Plus className="mr-2 h-4 w-4" />
                                Nova Proposta
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>Nova Proposta</DialogTitle>
                                <DialogDescription>
                                    Formalize uma proposta vinculada a um imóvel.
                                </DialogDescription>
                            </DialogHeader>
                            <ProposalForm
                                contactId={contactId}
                                organizationId={organizationId}
                                brokerId={brokerId}
                                onSuccess={() => setIsCreateOpen(false)}
                                onCancel={() => setIsCreateOpen(false)}
                            />
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {proposals.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg border-dashed">
                    <p className="text-muted-foreground mb-4">
                        Nenhuma proposta registrada para este cliente.
                    </p>
                    {canEdit && (
                        <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(true)}>
                            Criar a primeira proposta
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {proposals.map((proposal) => {
                        const contractRef = proposalContractMap.get(proposal.id)
                        return (
                        <div key={proposal.id} className="border rounded-lg p-4 flex flex-col gap-2 relative">
                            <div className="flex items-start justify-between">
                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${proposal.status === 'accepted' ? 'bg-green-100 text-green-700' :
                                        proposal.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                            proposal.status === 'counter_offer' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-blue-100 text-blue-700'
                                    }`}>
                                    {proposal.status === 'accepted' ? 'Aceita' :
                                        proposal.status === 'rejected' ? 'Rejeitada' :
                                            proposal.status === 'counter_offer' ? 'Contra-proposta' :
                                                'Pendente'}
                                </span>

                                {canEdit && !contractRef && (
                                    <Dialog open={editingProposal?.id === proposal.id} onOpenChange={(open) => {
                                        if (!open) setEditingProposal(null)
                                    }}>
                                        <DialogTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setEditingProposal(proposal)}>
                                                Editar
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[500px]">
                                            <DialogHeader>
                                                <DialogTitle>Editar Proposta</DialogTitle>
                                                <DialogDescription>
                                                    Atualize as condições ou o status da proposta.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <ProposalForm
                                                contactId={contactId}
                                                organizationId={organizationId}
                                                brokerId={brokerId}
                                                initialData={proposal}
                                                onSuccess={() => setEditingProposal(null)}
                                                onCancel={() => setEditingProposal(null)}
                                            />
                                        </DialogContent>
                                    </Dialog>
                                )}
                            </div>

                            <div className="mt-2">
                                <p className="text-sm text-muted-foreground">Valor Proposto</p>
                                <p className="font-semibold text-lg">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(proposal.proposed_value)}
                                </p>
                            </div>

                            {proposal.properties?.title && (
                                <div className="mt-1">
                                    <p className="text-xs text-muted-foreground">Imóvel</p>
                                    <p className="text-sm font-medium truncate">{proposal.properties.title}</p>
                                </div>
                            )}

                            {proposal.payment_conditions && (
                                <div className="mt-2 text-sm bg-muted/50 p-2 rounded-md">
                                    <span className="font-medium block text-xs mb-1">Pagamento:</span>
                                    <p className="line-clamp-2">{proposal.payment_conditions}</p>
                                </div>
                            )}

                            {proposal.valid_until && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    Válida até: {new Date(proposal.valid_until).toLocaleDateString("pt-BR")}
                                </p>
                            )}

                            {/* Contract indicator: shown when an auto-drafted contract exists for this proposal */}
                            {contractRef && (
                                <div className="mt-4 pt-3 border-t">
                                    <div className="flex items-center justify-between p-2.5 rounded-md bg-emerald-50 border border-emerald-100">
                                        <div className="flex items-center gap-2 text-emerald-800">
                                            <FileCheck2 className="h-4 w-4" />
                                            <div className="flex flex-col pt-0.5">
                                                <span className="text-xs font-semibold leading-none">Contrato Gerado</span>
                                                <span className="text-[10px] opacity-80 mt-1 capitalize">
                                                    Status: {contractRef.contractStatus === 'draft' ? 'Rascunho' : 
                                                             contractRef.contractStatus === 'active' ? 'Ativo' : 
                                                             contractRef.contractStatus === 'completed' ? 'Concluído' : 
                                                             contractRef.contractStatus === 'canceled' ? 'Cancelado' : 
                                                             contractRef.contractStatus}
                                                </span>
                                            </div>
                                        </div>
                                        <Link href="/contracts">
                                            <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-200 hover:bg-emerald-100 hover:text-emerald-900 bg-white">
                                                Ver Contratos
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
