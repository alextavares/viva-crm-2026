import { contactSchema, propertySchema } from '../lib/types'

describe('Zod Schemas Validation', () => {
    describe('contactSchema', () => {
        it('validates a valid contact', () => {
            const validContact = {
                name: 'John Doe',
                email: 'john@example.com',
                phone: '1234567890',
                type: 'lead',
                status: 'new',
                notes: 'Some notes'
            }
            expect(contactSchema.safeParse(validContact).success).toBe(true)
        })

        it('invalidates short name', () => {
            const invalidContact = {
                name: 'Jo',
                email: 'john@example.com'
            }
            const result = contactSchema.safeParse(invalidContact)

            if (!result.success) {
                if (result.error && Array.isArray(result.error.issues)) {

                    const msg = result.error.issues[0]?.message;
                    expect(msg).toContain('pelo menos 3 caracteres');
                } else {

                    expect(result.error).toBeDefined();
                }
            } else {
                expect(result.success).toBe(false)
            }
        })

        it('invalidates invalid email', () => {
            const invalidContact = {
                name: 'John Doe',
                email: 'not-an-email'
            }
            const result = contactSchema.safeParse(invalidContact)
            expect(result.success).toBe(false)
        })
    })

    describe('propertySchema', () => {
        it('validates a valid property', () => {
            const validProperty = {
                title: 'Nice Apartment',
                description: 'A great place',
                price: 500000,
                type: 'apartment',
                status: 'available',
                bedrooms: 2,
                bathrooms: 1,
                area: 70,
                address: '123 Main St',
                images: []
            }
            expect(propertySchema.safeParse(validProperty).success).toBe(true)
        })

        it('requires positive price', () => {
            const invalidProperty = {
                title: 'Nice Apartment',
                price: -100
            }
            const result = propertySchema.safeParse(invalidProperty)
            expect(result.success).toBe(false)
        })
    })
})
