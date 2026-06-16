import { describe, it, expect } from 'vitest'
import {
    computeBaseProductCost,
    computeAddOnCost,
    computeQuoteLineItems,
} from '@/lib/pricing'

describe('computeBaseProductCost', () => {
    it('computes monthly cost with no discount', () => {
        const cost = computeBaseProductCost(50, 25, 1, 0)
        expect(cost).toBe(1250)
    })

    it('computes annual cost with 15% discount', () => {
        const cost = computeBaseProductCost(50, 25, 12, 15)
        expect(cost).toBe(12750)
    })

    it('computes two-year cost with 25% discount', () => {
        const cost = computeBaseProductCost(50, 25, 24, 25)
        expect(cost).toBe(22500)
    })
})

describe('computeAddOnCost', () => {
    it('computes fixed monthly add-on', () => {
        const cost = computeAddOnCost(
            { featureName: 'SSO', pricingModel: 'fixed', price: 200 },
            12,
            12750,
        )
        expect(cost).toBe(2400)
    })

    it('computes per-seat add-on', () => {
        const cost = computeAddOnCost(
            { featureName: 'API Access', pricingModel: 'per_seat', price: 10, seats: 5 },
            12,
            12750,
        )
        expect(cost).toBe(600)
    })

    it('computes percentage add-on', () => {
        const cost = computeAddOnCost(
            { featureName: 'Premium Support', pricingModel: 'percentage', price: 20 },
            12,
            12750,
        )
        expect(cost).toBe(2550)
    })
})

describe('computeQuoteLineItems', () => {
    it('produces correct line items for sample quote (Analytics Suite, Growth, 25 seats, Annual, SSO + API Access)', () => {
        const result = computeQuoteLineItems({
            productName: 'Analytics Suite',
            tierName: 'Growth',
            basePrice: 50,
            seats: 25,
            termLength: 'annual',
            addOns: [
                { featureName: 'SSO Integration', pricingModel: 'fixed', price: 200 },
                { featureName: 'API Access', pricingModel: 'per_seat', price: 10, seats: 5 },
            ],
        })

        expect(result.lineItems).toHaveLength(3)

        // Base: 25 x $50 x 12 x 0.85 = $12,750
        expect(result.lineItems[0].amount).toBe(12750)

        // SSO: $200 x 12 = $2,400
        expect(result.lineItems[1].amount).toBe(2400)

        // API: 5 x $10 x 12 = $600
        expect(result.lineItems[2].amount).toBe(600)

        // Total: $15,750
        expect(result.total).toBe(15750)
    })

    it('applies overall discount correctly', () => {
        const result = computeQuoteLineItems({
            productName: 'Analytics Suite',
            tierName: 'Growth',
            basePrice: 50,
            seats: 25,
            termLength: 'annual',
            addOns: [
                { featureName: 'SSO Integration', pricingModel: 'fixed', price: 200 },
                { featureName: 'API Access', pricingModel: 'per_seat', price: 10, seats: 5 },
            ],
            overallDiscount: 10,
        })

        // Subtotal: $15,750
        // Discount: 10% = $1,575
        // Total: $14,175
        expect(result.lineItems).toHaveLength(4)
        expect(result.lineItems[3].label).toBe('Overall Discount')
        expect(result.lineItems[3].amount).toBe(-1575)
        expect(result.total).toBe(14175)
    })

    it('handles monthly term with no add-ons', () => {
        const result = computeQuoteLineItems({
            productName: 'Basic App',
            tierName: 'Starter',
            basePrice: 25,
            seats: 10,
            termLength: 'monthly',
            addOns: [],
        })

        expect(result.lineItems).toHaveLength(1)
        expect(result.lineItems[0].amount).toBe(250)
        expect(result.total).toBe(250)
    })

    it('handles percentage add-on based on base product cost', () => {
        const result = computeQuoteLineItems({
            productName: 'Analytics Suite',
            tierName: 'Growth',
            basePrice: 50,
            seats: 25,
            termLength: 'annual',
            addOns: [
                { featureName: 'Premium Support', pricingModel: 'percentage', price: 20 },
            ],
        })

        // Base: 25 x $50 x 12 x 0.85 = $12,750
        // Support: 20% x $12,750 = $2,550
        expect(result.lineItems[0].amount).toBe(12750)
        expect(result.lineItems[1].amount).toBe(2550)
        expect(result.total).toBe(15300)
    })

    it('matches sample quote: $18,300 total', () => {
        // Analytics Suite, Growth ($50), 25 seats, Annual
        // Add-ons: SSO ($200/mo fixed), API Access ($10/seat, 5 seats), Premium Support (20%)
        const result = computeQuoteLineItems({
            productName: 'Analytics Suite',
            tierName: 'Growth',
            basePrice: 50,
            seats: 25,
            termLength: 'annual',
            addOns: [
                { featureName: 'SSO Integration', pricingModel: 'fixed', price: 200 },
                { featureName: 'API Access', pricingModel: 'per_seat', price: 10, seats: 5 },
                { featureName: 'Premium Support', pricingModel: 'percentage', price: 20 },
            ],
        })

        // Base: 25 x $50 x 12 x 0.85 = $12,750
        // SSO: $200 x 12 = $2,400
        // API: 5 x $10 x 12 = $600
        // Support: 20% x $12,750 = $2,550
        // Total: $18,300
        expect(result.lineItems[0].amount).toBe(12750)
        expect(result.lineItems[1].amount).toBe(2400)
        expect(result.lineItems[2].amount).toBe(600)
        expect(result.lineItems[3].amount).toBe(2550)
        expect(result.total).toBe(18300)
    })

    it('generates readable calculation strings', () => {
        const result = computeQuoteLineItems({
            productName: 'Analytics Suite',
            tierName: 'Growth',
            basePrice: 50,
            seats: 25,
            termLength: 'annual',
            addOns: [
                { featureName: 'SSO Integration', pricingModel: 'fixed', price: 200 },
            ],
        })

        expect(result.lineItems[0].calculation).toContain('25 seats')
        expect(result.lineItems[0].calculation).toContain('$50 per seat per month')
        expect(result.lineItems[0].calculation).toContain('12 months')
        expect(result.lineItems[0].calculation).toContain('15%')
        expect(result.lineItems[1].calculation).toContain('$200 per month')
        expect(result.lineItems[1].calculation).toContain('12 months')
    })
})
