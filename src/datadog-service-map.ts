import * as sourcegraph from 'sourcegraph'

import { getOperationsForService, getServiceDependencies, getServicesByEnv, RequestConfig } from './api'
import { getOperationNameAndRangeFromHover } from './hover'
import { renderServiceDependenciesToMarkdown } from './render'

// NOTES:
// This is a demo extension. Here are the known limitations we should address:
// - Limitation: Only works for JS/TS
//     - Fix: simple, add patterns for all supported languages
// - Limitation: Environment is set in user settings, defaults to "prod"
//     - Fix: add QuickPick to extension API, fallback to InputBox for older versions. Move
//       service deps from hover to panel, allow users to select environment each time they
//       click on the Datadog editor/toolbar or hover action, which will then open the panel
// - Limitation: Susceptible to hitting rate limits
//     - Fix: Caching across sessions(position -> service name object in user settings?), smart prioritization of service name -> operation name requests (if possible)
// - Limitation: Requires CORS proxy
//      - Fix: default to Sourcegraph CORS proxy, users can configure their own. We need to add
//        the Datadog API to the allowlist
// - Limitation: Time range is set in user settings
//      - Fix: not too big a deal, not sure if it needs fixing
// - Limitation: When hovering over service init, may show service data for services in "nephew/niece" directories in large monorepos
//    when the viewed service has no custom instrumentation but the service in the "nephew/niece" directory does
//      - Fix: infer service boundaries by looking for manifest files (e.g. package.json), don't search across projects
//        However, this is likely so uncommon that we shouldn't proactively tackle this.

// Request flow:
// (Currently implemented) From operation name definition:
//          get list of services (Datadog API) -> get operation names for each service (Datadog API) -> use first service that has a matching operation name (In extension)
//            (in future we can go through more and rank in case of repeated operation names)
//
// (Not yet implemented) From any other tracing library calls (like tracing init) that don't give use any useful hints:
//          search for custom instrumentation calls in this language in this file. If not found, search in subdirectory. Extract operation names. (In extension, fallback to Sourcegraph GQL API) ->
//          get list of services (Datadog API) -> get operation names for each service (Datadog API) -> use first service that has a matching operation name. try to match operations closest to this file first (In extension)

async function inferServiceNameFromOperationName({
    operationName,
    services,
    requestConfig,
}: {
    operationName: string
    services: string[]
    requestConfig: RequestConfig
}): Promise<string | undefined> {
    const BATCH_SIZE = 25 // Arbitrary, modify as needed.
    let cursor = 0

    while (cursor < services.length) {
        const servicesBatch = services.slice(cursor, cursor + BATCH_SIZE)

        const operations = (
            await Promise.all(
                servicesBatch.map(serviceName => getOperationsForService({ serviceName, ...requestConfig }))
            )
        ).flat()

        for (const operation of operations) {
            if (operation.name === operationName) {
                return operation.service
            }
        }

        cursor += BATCH_SIZE
    }

    return
}

interface Configuration {
    'datadogServiceMap.env'?: string
    'datadogServiceMap.corsAnywhereUrl'?: string | null
    'datadogServiceMap.apiKey'?: string
    'datadogServiceMap.applicationKey'?: string

    // Currently not used:
    // 'datadogServiceMap.secondsAgo'?: number
    // JSON Schema for "configuration" property:
    // "datadogServiceMap.secondsAgo": {
    //     "description": "How many seconds from the present to include in service queries. 1 day (86400 seconds) by default.",
    //     "type": [
    //       "number"
    //     ],
    //     "default": 86400
    //   }
    // For the MVP, we start requests from "0" (epoch timestamp).
    // IF users ask to constrain the time period, we can add this property.
}

const getConfig = (): Configuration => sourcegraph.configuration.get<Configuration>().value

export function activate(context: sourcegraph.ExtensionContext): void {
    const state = {
        configureKeysNotificationShown: false,
    }

    let config: Configuration = {}
    sourcegraph.configuration.subscribe(() => {
        // This is synchronously called on subscription.
        config = getConfig()
    })

    // TODO: address non-reactivity of hover overlay actions to context. Updating context for `open` command argument
    // doesn't trigger re-render of hover overlay actions, so we should take control of the hover overlay action.
    // For now, render link in markdown instead.
    // context.subscriptions.add(
    //     sourcegraph.commands.registerCommand('datadogServiceMap.goToMap', () => {
    //         if (state.linkToMap) {
    //             sourcegraph.commands.executeCommand('open', state.linkToMap).catch(() => {
    //                 // Noop
    //             })
    //         }
    //     })
    // )

    context.subscriptions.add(
        sourcegraph.languages.registerHoverProvider(['*'], {
            provideHover: async (document, position) => {
                const operationNameAndRange = getOperationNameAndRangeFromHover(document, position)

                if (!operationNameAndRange) {
                    return
                }

                const { operationName, range } = operationNameAndRange

                const apiKey = config['datadogServiceMap.apiKey']
                const applicationKey = config['datadogServiceMap.applicationKey']
                if (!apiKey || !applicationKey) {
                    if (!state.configureKeysNotificationShown) {
                        sourcegraph.app.activeWindow?.showNotification(
                            'Set your Datadog API and Application keys to view service dependencies',
                            sourcegraph.NotificationType.Warning
                        )
                        state.configureKeysNotificationShown = true
                    }
                    return
                }

                const requestConfig: RequestConfig = {
                    corsProxy: config['datadogServiceMap.corsAnywhereUrl'] ?? 'http://localhost:8080',
                    API_KEY: apiKey,
                    APPLICATION_KEY: applicationKey,
                }
                const env = config['datadogServiceMap.env'] ?? 'prod'

                const servicesByEnv = await getServicesByEnv(requestConfig)

                const servicesForSelectedEnv = servicesByEnv[env] ?? []

                const serviceName = await inferServiceNameFromOperationName({
                    operationName,
                    services: servicesForSelectedEnv,
                    requestConfig,
                })

                if (!serviceName) {
                    return
                }

                const serviceDependencies = await getServiceDependencies({
                    serviceName,
                    env,
                    ...requestConfig,
                })

                const markdown = renderServiceDependenciesToMarkdown({
                    serviceDependencies,
                    serviceName,
                    env,
                })

                return {
                    range,
                    contents: {
                        kind: sourcegraph.MarkupKind.Markdown,
                        value: markdown,
                    },
                }
            },
        })
    )
}

// TODO: can determine all dependencies, render direct and transitive deps differently if transitive deps exist.
// This will ensure that we provide value even in the case of 'http-client' type service names.

// Sourcegraph extension documentation: https://docs.sourcegraph.com/extensions/authoring
