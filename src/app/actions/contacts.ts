"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function addContactNote(contactId: string, text: string) {
    if (!contactId || !text.trim()) {
        throw new Error("Missing parameters")
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error("Unauthorized")
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) {
        throw new Error("No organization found for user")
    }

    const { data: contact } = await supabase
        .from("contacts")
        .select("organization_id")
        .eq("id", contactId)
        .single()

    if (!contact || contact.organization_id !== profile.organization_id) {
        throw new Error("Contact not found or access denied")
    }

    const { error } = await supabase.from("contact_events").insert({
        contact_id: contactId,
        type: "note_added",
        source: "crm_manual",
        payload: {
            text: text.trim(),
            created_by: user.id
        }
    })

    if (error) {
        console.error("Error adding note:", error)
        throw new Error("Failed to add note")
    }

    revalidatePath(`/contacts/${contactId}`)
}
