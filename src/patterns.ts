interface LanguagePatterns {
    operationName: RegExp[]
}

const JS_TS_OPERATION_NAME_PATTERNS = [/tracer\.trace\("(.*?)"/] // Technically, the dd-trace export isn't necesarrily called assigned to `tracer`

export const patternsByLanguage: Record<string, LanguagePatterns> = {
    javascript: {
        operationName: JS_TS_OPERATION_NAME_PATTERNS,
    },
    typescript: {
        operationName: JS_TS_OPERATION_NAME_PATTERNS,
    },
}
