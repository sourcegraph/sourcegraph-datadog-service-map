import mock from 'mock-require'
import { createStubSourcegraphAPI, createStubExtensionContext } from '@sourcegraph/extension-api-stubs'
const sourcegraph = createStubSourcegraphAPI()
mock('sourcegraph', sourcegraph)

import { activate } from './datadog-service-map'

describe('datadog-service-map', () => {
    it('should activate successfully', async () => {
        const context = createStubExtensionContext()
        await activate(context)
    })

    // Test patterns against code
})
