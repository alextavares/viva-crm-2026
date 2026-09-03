declare module "papaparse" {
    export type ParseError = { message: string }

    export type ParseResult<T> = {
        data: T[]
        errors: ParseError[]
    }

    export type ParseConfig<T> = {
        header?: boolean
        skipEmptyLines?: boolean
        complete?: (results: ParseResult<T>) => void
        error?: (error: ParseError) => void
    }

    const Papa: {
        parse<T = unknown>(file: File, config: ParseConfig<T>): void
    }

    export default Papa
}
