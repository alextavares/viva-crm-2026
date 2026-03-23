import { Resend } from 'resend'

const resendApiKey = process.env.RESEND_API_KEY
// Instancia o resend apenas se tiver a API Key, do contrário envia mock.
const resend = resendApiKey ? new Resend(resendApiKey) : null

interface SendEmailParams {
    to: string | string[]
    subject: string
    html: string
    text?: string
}

export async function sendTransactionalEmail(params: SendEmailParams) {
    if (!resend) {
        console.info('[Email Simulator] Resend API Key is missing. Simulating email send:')
        console.info(`  To: ${Array.isArray(params.to) ? params.to.join(', ') : params.to}`)
        console.info(`  Subject: ${params.subject}`)
        console.info(`  HTML Length: ${params.html.length} chars`)
        return { success: true, simulated: true }
    }

    try {
        const { data, error } = await resend.emails.send({
            // Mude para o domínio verificado depois
            from: 'Imobi CRM <onboarding@resend.dev>',
            to: params.to,
            subject: params.subject,
            html: params.html,
            text: params.text,
        })

        if (error) {
            console.error('[Email Error] Failed to send email via Resend:', error)
            return { success: false, error }
        }

        return { success: true, data }
    } catch (error) {
        console.error('[Email Error] Unexpected error sending email:', error)
        return { success: false, error }
    }
}
