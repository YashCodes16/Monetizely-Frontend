import { describe, it, expect } from 'vitest'
import {
    getTermConfig,
    computeBaseProductCost,
    computeAddOnCost,
    computeQuoteLineItems,
} from '@/lib/pricing'

describe('getTermConfig - edge cases', () => {
    it('returns monthly config for unknown term', () => {
        const config = getTermConfig('weekly')
        expect(config.multiplier).toBe(1)
        expect(config.discount).toBe(0)
    })

    it('returns monthly config for empty string', () => {
        const config = getTermConfig('')
        expect(config.multiplier).toBe(1)
    })
})

describe('computeBaseProductCost - edge cases', () => {
    it('handles 1 seat monthly', () => {
        expect(computeBaseProductCost(100, 1, 1, 0)).toBe(100)
    })

    it('handles large seat count', () => {
        expect(computeBaseProductCost(10, 1000, 1, 0)).toBe(10000)
    })

    it('handles 100% discount', () => {
        expect(computeBaseProductCost(50, 10, 12, 100)).toBe(0)
    })

    it('handles fractional price', () => {
        expect(computeBaseProductCost(9.99, 1, 1, 0)).toBeCloseTo(9.99)
    })
})

describe('computeAddOnCost - edge cases', () => {
    it('per_seat with 1 seat and 1 month', () => {
        const cost = computeAddOnCost(
            { featureName: 'API', pricingModel: 'per_seat', price: 15, seats: 1 },
            1,
            0,
        )
        expect(cost).toBe(15)
    })

    it('percentage with 0 base cost', () => {
        const cost = computeAddOnCost(
            { featureName: 'Support', pricingModel: 'percentage', price: 20 },
            12,
            0,
        )
        expect(cost).toBe(0)
    })

    it('fixed with 1 month', () => {
        const cost = computeAddOnCost(
            { featureName: 'SSO', pricingModel: 'fixed', price: 99 },
            1,
            5000,
        )
        expect(cost).toBe(99)
    })

    it('per_seat with many seats', () => {
        const cost = computeAddOnCost(
            { featureName: 'Seats', pricingModel: 'per_seat', price: 5, seats: 100 },
            12,
            0,
        )
        expect(cost).toBe(6000)
    })
})

describe('computeQuoteLineItems - edge cases', () => {
    it('single seat monthly no add-ons is just basePrice', () => {
        const result = computeQuoteLineItems({
            productName: 'Widget',
            tierName: 'Free',
            basePrice: 0,
            seats: 1,
            termLength: 'monthly',
            addOns: [],
        })
        expect(result.total).toBe(0)
        expect(result.lineItems).toHaveLength(1)
    })

    it('overall discount of 100% results in 0 total', () => {
        const result = computeQuoteLineItems({
            productName: 'App',
            tierName: 'Pro',
            basePrice: 50,
            seats: 10,
            termLength: 'monthly',
            addOns: [],
            overallDiscount: 100,
        })
        expect(result.total).toBe(0)
    })

    it('multiple per_seat add-ons with different seat counts', () => {
        const result = computeQuoteLineItems({
            productName: 'Suite',
            tierName: 'Enterprise',
            basePrice: 100,
            seats: 10,
            termLength: 'monthly',
            addOns: [
                { featureName: 'Module A', pricingModel: 'per_seat', price: 20, seats: 5 },
                { featureName: 'Module B', pricingModel: 'per_seat', price: 30, seats: 3 },
            ],
        })

        // Base: 10 * 100 * 1 = 1000
        // Module A: 5 * 20 * 1 = 100
        // Module B: 3 * 30 * 1 = 90
        expect(result.lineItems[0].amount).toBe(1000)
        expect(result.lineItems[1].amount).toBe(100)
        expect(result.lineItems[2].amount).toBe(90)
        expect(result.total).toBe(1190)
    })

    it('overall discount applies after add-ons', () => {
        const result = computeQuoteLineItems({
            productName: 'App',
            tierName: 'Pro',
            basePrice: 100,
            seats: 1,
            termLength: 'monthly',
            addOns: [
                { featureName: 'SSO', pricingModel: 'fixed', price: 100 },
            ],
            overallDiscount: 50,
        })

        // Base: 100, SSO: 100, subtotal: 200, discount: 100
        expect(result.total).toBe(100)
    })

    it('two_year term applies 25% discount on base', () => {
        const result = computeQuoteLineItems({
            productName: 'App',
            tierName: 'Pro',
            basePrice: 100,
            seats: 1,
            termLength: 'two_year',
            addOns: [],
        })

        // 1 * 100 * 24 * 0.75 = 1800
        expect(result.lineItems[0].amount).toBe(1800)
        expect(result.total).toBe(1800)
    })

    it('percentage add-on uses base product cost not subtotal', () => {
        const result = computeQuoteLineItems({
            productName: 'App',
            tierName: 'Pro',
            basePrice: 100,
            seats: 10,
            termLength: 'monthly',
            addOns: [
                { featureName: 'Fixed', pricingModel: 'fixed', price: 500 },
                { featureName: 'Support', pricingModel: 'percentage', price: 10 },
            ],
        })

        // Base: 10 * 100 = 1000
        // Fixed: 500
        // Support: 10% of 1000 (base only) = 100
        expect(result.lineItems[2].amount).toBe(100)
        expect(result.total).toBe(1600)
    })
})
