import '@testing-library/jest-dom'

import { TextDecoder, TextEncoder } from 'node:util'

global.TextEncoder = global.TextEncoder ?? TextEncoder
global.TextDecoder = global.TextDecoder ?? TextDecoder

jest.mock('next/cache', () => ({
    revalidatePath: jest.fn(),
    revalidateTag: jest.fn(),
    unstable_cache: jest.fn((callback) => callback),
}))
