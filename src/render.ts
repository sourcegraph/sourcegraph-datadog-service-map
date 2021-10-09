import { ServiceDependencies } from './api'

export function renderServiceDependenciesToMarkdown({
    serviceDependencies,
    serviceName,
    env,
}: {
    serviceDependencies: ServiceDependencies
    serviceName: string
    env: string
}): string {
    let table = `#### Datadog service: ${serviceName}\n---\n\n| Calls | Called by |\n| --- | ----------- |`

    const called_by = [...serviceDependencies.called_by]
    const calls = [...serviceDependencies.calls]

    if (called_by.length === 0) {
        called_by.push('Not called by any service')
    }
    if (calls.length === 0) {
        calls.push("Doesn't call any service")
    }

    const iterations = Math.max(calls.length, called_by.length)

    for (let index = 0; index < iterations; index++) {
        table += `\n| ${calls[index] ?? ''} | ${called_by[index] ?? ''} |`
    }

    // for (const call of serviceDependencies.calls) {
    //     table += `\n| ${call} |  |`
    // }

    // Link to Datadog service map for the previous day.
    const { start, end } = getStartAndEnd()
    const link = `https://app.datadoghq.com/apm/map?env=${env}&start=${start}&end=${end}&service=${serviceName}`

    table += `\n\n[View full service map on datadog](${link})`

    return table
}

function getStartAndEnd(): { start: number; end: number } {
    const end = Date.now()

    const today = new Date()
    today.setDate(today.getDate() - 1)

    return {
        start: today.getTime(),
        end,
    }
}
