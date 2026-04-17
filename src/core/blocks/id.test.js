import { describe, it, expect } from 'vitest'
import { generateBlockId } from './id.js'

describe('generateBlockId', () => {
  it('returns a 10-char base36 string', () => {
    const id = generateBlockId()
    expect(id).toMatch(/^[0-9a-z]{10}$/)
  })

  it('generates unique values across many calls', () => {
    const ids = new Set()
    for (let i = 0; i < 10_000; i++) {
      ids.add(generateBlockId())
    }
    expect(ids.size).toBe(10_000)
  })

  it('distribution is not obviously biased (each char slot uses varied alphabet)', () => {
    // Sanity check: generate 1000 IDs, look at first-char distribution.
    // Biased generator would cluster; uniform would hit >10 distinct chars.
    const firstChars = new Set()
    for (let i = 0; i < 1000; i++) {
      firstChars.add(generateBlockId()[0])
    }
    expect(firstChars.size).toBeGreaterThan(20)
  })
})
