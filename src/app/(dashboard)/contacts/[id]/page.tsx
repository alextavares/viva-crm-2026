import { ContactForm } from "@/components/contacts/contact-form"
import { createClient } from "@/lib/supabase/server"
import { buildWhatsAppUrl } from "@/lib/whatsapp"
import { notFound } from "next/navigation"

interface PageProps {
    params: Promise<{
        id: string
    }>
}

export default async function ContactEditPage({ params }: PageProps) {
    const { id } = await params
    const supabase = await createClient()

    const { data: contact } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single()

    if (!contact) {
        notFound()
    }

    const waHref = contact.phone
        ? buildWhatsAppUrl({
            phone: contact.phone,
            message: contact.name ? `Olá ${contact.name}, tudo bem?` : "Olá, tudo bem?",
          })
        : null

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-lg font-semibold md:text-2xl">Editar Contato</h1>
                    <p className="text-muted-foreground">Atualize as informações do contato.</p>
                </div>
                {waHref ? (
                    <a
                        className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                        href={waHref}
                        target="_blank"
                        rel="noreferrer"
                    >
                        Chamar no WhatsApp
                    </a>
                ) : null}
            </div>

            <div className="border rounded-lg p-4 bg-muted/10">
                <ContactForm initialData={contact} />
            </div>
        </div>
    )
}
