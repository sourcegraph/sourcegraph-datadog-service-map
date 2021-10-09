import * as sourcegraph from 'sourcegraph'

import { patternsByLanguage } from './patterns'

export function getOperationNameAndRangeFromHover(
    document: sourcegraph.TextDocument,
    position: sourcegraph.Position
): { range: sourcegraph.Range; operationName: string } | undefined {
    const patterns = patternsByLanguage[document.languageId]?.operationName

    if (!patterns || patterns.length === 0) {
        return
    }

    const lines = document.text?.split('\n')
    const hoveredLine = lines?.[position.line]

    if (!hoveredLine) {
        return
    }

    const match = hoveredLine.match(patterns[0])

    if (!match) {
        return
    }

    const [toHighlight, operationName] = match
    const { index } = match

    const toHighlightRange = new sourcegraph.Range(
        new sourcegraph.Position(position.line, index ?? 0),
        new sourcegraph.Position(position.line, index ? index + toHighlight.length : hoveredLine.length) // If index is somehow undefined, highlight the whole line
    )

    if (!toHighlightRange.contains(position)) {
        return
    }

    return {
        range: toHighlightRange,
        operationName,
    }
}
