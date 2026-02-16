import { ContactForm } from "@/components/contacts/contact-form"

export default function NewContactPage() {
    return (
        <div className="flex flex-col gap-4">
            <div>
                <h1 className="text-lg font-semibold md:text-2xl">Novo Contato</h1>
                <p className="text-muted-foreground">Cadastre um lead, cliente ou proprietário.</p>
            </div>

            <div className="border rounded-lg p-4 bg-muted/10">
                <ContactForm />
            </div>
        </div>
    )
}
