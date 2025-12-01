import { describe, it, expect } from 'vitest'
import { createPluginSandbox, SecurePluginSandbox } from './pluginUtils'

describe('pluginUtils', () => {
    it('should create a sandbox instance', () => {
        const plugin = { id: 'test', permissions: [] }
        const sandbox = createPluginSandbox(plugin)
        expect(sandbox).toBeInstanceOf(SecurePluginSandbox)
        expect(sandbox.plugin).toBe(plugin)
    })
})
