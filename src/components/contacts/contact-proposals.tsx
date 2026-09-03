"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, FileCheck2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
    canDeleteProposalRecord,
    canEditProposalRecord,
    type DealContract,
    type DealProposal,
} from "@/lib/types"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { deleteProposal } from "@/app/actions/proposals"
import { ProposalForm } from "./proposal-form"
import { ContractForm } from "@/components/contracts/contract-form"

interface ContactProposalsProps {
    contactId: string
    organizationId: string
    assignedTo?: string | null
    initialProposals: DealProposal[]
    proposalContracts?: Record<string, DealContract>
    currentUserId?: string | null
    currentUserRole?: string | null
    canCreateProposal?: boolean
}

export function ContactProposals({
    contactId,
    organizationId,
    assignedTo,
    initialProposals,
    proposalContracts = {},
    currentUserId = null,
    currentUserRole = null,
    canCreateProposal = false,
}: ContactProposalsProps) {
    const router = useRouter()
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [editingProposal, setEditingProposal] = useState<DealProposal | null>(null)
    const [deletingProposalId, setDeletingProposalId] = useState<string | null>(null)
    const [reviewingContract, setReviewingContract] = useState<DealContract | null>(null)
    const canEditContracts = currentUserRole === "owner" || currentUserRole === "manager"

    function handleSuccess() {
        setIsCreateOpen(false)
        setEditingProposal(null)
        setReviewingContract(null)
        router.refresh()
    }

    const contractStatusMeta = useMemo(
        () => ({
            draft: {
                label: "Rascunho",
                className: "border-amber-200 bg-amber-50 text-amber-800",
            },
            active: {
                label: "Ativo",
                className: "border-emerald-200 bg-emerald-50 text-emerald-800",
            },
            completed: {
                label: "Concluído",
                className: "border-blue-200 bg-blue-50 text-blue-800",
            },
            canceled: {
                label: "Cancelado",
                className: "border-rose-200 bg-rose-50 text-rose-800",
            },
            default: {
                label: "Indefinido",
                className: "border-muted bg-muted/50 text-foreground",
            },
        }),
        []
    )

    async function handleDelete(proposalId: string) {
        setDeletingProposalId(proposalId)
        try {
            const result = await deleteProposal(proposalId, contactId)
            if (result.error) {
                toast.error(result.error)
                return
            }
            toast.success("Proposta excluída com sucesso")
            router.refresh()
        } finally {
            setDeletingProposalId(null)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-base font-semibold">Propostas Comerciais</h2>
                    <p className="text-sm text-muted-foreground">
                        Gerencie as negociações ativas com este cliente.
                    </p>
                </div>

                {canCreateProposal && (
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
                                assignedTo={assignedTo}
                                onSuccess={handleSuccess}
                                onCancel={() => setIsCreateOpen(false)}
                            />
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {initialProposals.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg border-dashed">
                    <p className="text-muted-foreground mb-4">
                        Nenhuma proposta registrada para este cliente.
                    </p>
                    {canCreateProposal && (
                        <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(true)}>
                            Criar a primeira proposta
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {initialProposals.map((proposal) => {
                        const contractRef = proposalContracts[proposal.id]
                        const canEditProposal =
                            !contractRef &&
                            canEditProposalRecord(currentUserRole, currentUserId, proposal.assigned_to)
                        const canDeleteProposal =
                            !contractRef && canDeleteProposalRecord(currentUserRole)
                        const contractStatus =
                            (contractRef?.status && contractStatusMeta[contractRef.status as keyof typeof contractStatusMeta]) ||
                            contractStatusMeta.default
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

                                <div className="flex items-center gap-1">
                                    {canEditProposal && (
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
                                                    assignedTo={assignedTo}
                                                    initialData={proposal}
                                                    onSuccess={handleSuccess}
                                                    onCancel={() => setEditingProposal(null)}
                                                />
                                            </DialogContent>
                                        </Dialog>
                                    )}
                                    {canDeleteProposal ? (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive hover:text-destructive">
                                                    Excluir
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Excluir proposta?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Essa ação remove a proposta da ficha do contato e não pode ser desfeita.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => void handleDelete(proposal.id)}
                                                        className="bg-destructive hover:bg-destructive/90"
                                                        disabled={deletingProposalId === proposal.id}
                                                    >
                                                        {deletingProposalId === proposal.id ? "Excluindo..." : "Excluir"}
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    ) : null}
                                </div>
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
                                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-md bg-muted/30 border">
                                        <div className="flex items-center gap-2 text-foreground min-w-0">
                                            <FileCheck2 className="h-4 w-4" />
                                            <div className="flex flex-col pt-0.5 min-w-0">
                                                <span className="text-xs font-semibold leading-none">Contrato vinculado</span>
                                                <span className="text-[10px] opacity-80 mt-1">
                                                    Contrato: {contractRef.id.slice(0, 8)}
                                                    {contractRef.contract_type
                                                        ? ` · ${contractRef.contract_type === "sale" ? "Venda" : "Locação"}`
                                                        : ""}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge variant="outline" className={contractStatus.className}>
                                                {contractStatus.label}
                                            </Badge>
                                            {canEditContracts ? (
                                                <Dialog
                                                    open={reviewingContract?.id === contractRef.id}
                                                    onOpenChange={(open) => {
                                                        if (!open) setReviewingContract(null)
                                                    }}
                                                >
                                                    <DialogTrigger asChild>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 text-xs"
                                                            onClick={() => setReviewingContract(contractRef)}
                                                        >
                                                            Revisar contrato
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                                                        <DialogHeader>
                                                            <DialogTitle>Revisar contrato</DialogTitle>
                                                            <DialogDescription>
                                                                Revise o contrato vinculado a esta proposta sem sair da ficha do contato.
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <ContractForm
                                                            organizationId={organizationId}
                                                            contactId={contactId}
                                                            assignedTo={assignedTo}
                                                            initialData={contractRef}
                                                            onSuccess={handleSuccess}
                                                            onCancel={() => setReviewingContract(null)}
                                                        />
                                                    </DialogContent>
                                                </Dialog>
                                            ) : null}
                                        </div>
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
