export interface RequestConfig {
    corsProxy: string
    APPLICATION_KEY: string
    API_KEY: string
}

type ServicesByEnv = Record<string, string[]>

export const getServicesByEnv = memoizeAsync(
    async ({ corsProxy, APPLICATION_KEY, API_KEY }: RequestConfig): Promise<ServicesByEnv> => {
        const url = `${corsProxy}/https://api.datadoghq.com/trace/api/services_by_env?from=0`

        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                'DD-API-KEY': API_KEY,
                'DD-APPLICATION-KEY': APPLICATION_KEY,
            },
        })

        if (!response.ok) {
            throw new Error(`Request failed with ${response.status}: ${response.statusText}`)
        }

        const services: ServicesByEnv = await response.json()

        return services
    },
    () => 'fixed'
)

interface OperationsResponse {
    operation_names: Operation[]
}

interface Operation {
    type: string
    name: string
    service: string
}

export const getOperationsForService = memoizeAsync(
    async ({
        serviceName,
        corsProxy,
        APPLICATION_KEY,
        API_KEY,
    }: {
        serviceName: string
    } & RequestConfig): Promise<Operation[]> => {
        const url = `${corsProxy}/https://api.datadoghq.com/api/v1/trace/operation_names/${serviceName}`

        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                'DD-API-KEY': API_KEY,
                'DD-APPLICATION-KEY': APPLICATION_KEY,
            },
        })

        if (!response.ok) {
            throw new Error(`Request failed with ${response.status}: ${response.statusText}`)
        }

        const operationsResponse: OperationsResponse = await response.json()

        return operationsResponse.operation_names
    },
    ({ serviceName }) => serviceName
)

/** Dependencies (upstream and downstream) of one service */
export interface ServiceDependencies {
    called_by: string[]
    calls: string[]
    name: string
}

export const getServiceDependencies = memoizeAsync(
    async ({
        serviceName,
        env,
        corsProxy,
        APPLICATION_KEY,
        API_KEY,
    }: {
        serviceName: string
        env: string
    } & RequestConfig): Promise<ServiceDependencies> => {
        const url = `${corsProxy}/https://api.datadoghq.com/api/v1/service_dependencies/${serviceName}?env=${env}&start=0`

        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                'DD-API-KEY': API_KEY,
                'DD-APPLICATION-KEY': APPLICATION_KEY,
            },
        })

        if (!response.ok) {
            throw new Error(`Request failed with ${response.status}: ${response.statusText}`)
        }

        const serviceDependencies: ServiceDependencies = await response.json()

        return serviceDependencies
    },
    ({ serviceName }) => serviceName
)

/**
 * Creates a function that memoizes the async result of func. If the Promise is rejected, the result will not be
 * cached.
 *
 * @param func The function to memoize
 * @param toKey Determines the cache key for storing the result based on the first argument provided to the memoized
 * function
 */
function memoizeAsync<P, T>(func: (params: P) => Promise<T>, toKey: (params: P) => string): (params: P) => Promise<T> {
    const cache = new Map<string, Promise<T>>()
    return (params: P) => {
        const key = toKey(params)
        const hit = cache.get(key)
        if (hit) {
            return hit
        }
        const p = func(params)
        p.then(null, () => cache.delete(key))
        cache.set(key, p)
        return p
    }
}
