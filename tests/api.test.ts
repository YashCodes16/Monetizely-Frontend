import { describe, it, expect } from 'vitest'
import { resolveBasePrice, API_URL } from '@/lib/api'

describe('API_URL', () => {
    it('points to localhost backend', () => {
        expect(API_URL).toBe('http://localhost:5000/api')
    })
})

describe('resolveBasePrice', () => {
    it('returns the value from a monthly base price', () => {
        expect(resolveBasePrice({ value: 50, frequency: 'monthly' })).toBe(50)
    })

    it('returns the value from an annual base price', () => {
        expect(resolveBasePrice({ value: 120, frequency: 'annual' })).toBe(120)
    })

    it('returns 0 when value is 0', () => {
        expect(resolveBasePrice({ value: 0, frequency: 'monthly' })).toBe(0)
    })
})
