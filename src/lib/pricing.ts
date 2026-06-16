export interface AddOnInput {
    featureName: string
    pricingModel: 'fixed' | 'per_seat' | 'percentage'
    price: number
    seats?: number
}

export interface QuoteInput {
    productName: string
    tierName: string
    basePrice: number
    seats: number
    termLength: 'monthly' | 'annual' | 'two_year'
    addOns: AddOnInput[]
    overallDiscount?: number
}

export interface LineItem {
    label: string
    calculation: string
    notes: string
    amount: number
}

export interface QuoteResult {
    lineItems: LineItem[]
    total: number
}

const TERM_CONFIG: Record<string, { multiplier: number, discount: number, label: string }> = {
    monthly: { multiplier: 1, discount: 0, label: 'Monthly' },
    annual: { multiplier: 12, discount: 15, label: 'Annual (12 months)' },
    two_year: { multiplier: 24, discount: 25, label: '2-Year (24 months)' },
}

export function getTermConfig(termLength: string) {
    return TERM_CONFIG[termLength] || TERM_CONFIG.monthly
}

export function computeBaseProductCost(
    basePrice: number,
    seats: number,
    termMonths: number,
    discountPercent: number,
): number {
    return seats * basePrice * termMonths * (1 - discountPercent / 100)
}

export function computeAddOnCost(
    addOn: AddOnInput,
    termMonths: number,
    baseProductCost: number,
): number {
    switch (addOn.pricingModel) {
        case 'fixed':
            return addOn.price * termMonths
        case 'per_seat':
            return (addOn.seats || 0) * addOn.price * termMonths
        case 'percentage':
            return (addOn.price / 100) * baseProductCost
        default:
            return 0
    }
}

export function computeQuoteLineItems(input: QuoteInput): QuoteResult {
    const term = getTermConfig(input.termLength)
    const lineItems: LineItem[] = []

    const baseProductCost = computeBaseProductCost(
        input.basePrice,
        input.seats,
        term.multiplier,
        term.discount,
    )

    lineItems.push({
        label: `${input.productName} - ${input.tierName} tier`,
        calculation: `${input.seats} seats × $${input.basePrice} per seat per month × ${term.multiplier} months${term.discount > 0 ? ` × (1 - ${term.discount}% ${term.label.toLowerCase().split(' ')[0]} discount)` : ''}`,
        notes: 'Base product cost',
        amount: baseProductCost,
    })

    let addOnTotal = 0

    for (const addOn of input.addOns) {
        const addOnCost = computeAddOnCost(addOn, term.multiplier, baseProductCost)
        addOnTotal += addOnCost

        let calculation = ''
        let notes = ''

        switch (addOn.pricingModel) {
            case 'fixed':
                calculation = `$${addOn.price} per month × ${term.multiplier} months`
                notes = 'Fixed monthly add-on price'
                break
            case 'per_seat':
                calculation = `${addOn.seats} seats × $${addOn.price} per seat per month × ${term.multiplier} months`
                notes = 'Per-seat add-on'
                break
            case 'percentage':
                calculation = `${addOn.price}% of base product cost ($${baseProductCost.toLocaleString()})`
                notes = 'Percentage of base product cost'
                break
        }

        lineItems.push({
            label: `Add-on: ${addOn.featureName}`,
            calculation,
            notes,
            amount: addOnCost,
        })
    }

    const subtotal = baseProductCost + addOnTotal
    let total = subtotal

    if (input.overallDiscount && input.overallDiscount > 0) {
        const discountAmount = subtotal * (input.overallDiscount / 100)
        lineItems.push({
            label: 'Overall Discount',
            calculation: `${input.overallDiscount}% off subtotal ($${subtotal.toLocaleString()})`,
            notes: 'Applied to entire quote',
            amount: -discountAmount,
        })
        total = subtotal - discountAmount
    }

    return { lineItems, total }
}
