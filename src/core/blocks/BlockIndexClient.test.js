import { describe, it, expect, beforeEach } from 'vitest'
import { LRU } from './BlockIndexClient.js'

describe('LRU cache', () => {
  it('returns undefined on miss, value on hit', () => {
    const lru = new LRU(3)
    expect(lru.get('x')).toBeUndefined()
    lru.set('x', 1)
    expect(lru.get('x')).toBe(1)
  })

  it('evicts least-recently-used when full', () => {
    const lru = new LRU(2)
    lru.set('a', 1)
    lru.set('b', 2)
    lru.set('c', 3) // evicts 'a'
    expect(lru.get('a')).toBeUndefined()
    expect(lru.get('b')).toBe(2)
    expect(lru.get('c')).toBe(3)
  })

  it('refreshes recency on get', () => {
    const lru = new LRU(2)
    lru.set('a', 1)
    lru.set('b', 2)
    lru.get('a') // a is now most recent
    lru.set('c', 3) // should evict b, not a
    expect(lru.get('a')).toBe(1)
    expect(lru.get('b')).toBeUndefined()
  })

  it('delete removes a key', () => {
    const lru = new LRU(3)
    lru.set('a', 1)
    lru.delete('a')
    expect(lru.get('a')).toBeUndefined()
  })

  it('deletePrefix removes all matching keys', () => {
    const lru = new LRU(10)
    lru.set('search:foo', 1)
    lru.set('search:bar', 2)
    lru.set('resolve:x', 3)
    lru.deletePrefix('search:')
    expect(lru.get('search:foo')).toBeUndefined()
    expect(lru.get('search:bar')).toBeUndefined()
    expect(lru.get('resolve:x')).toBe(3)
  })
})
