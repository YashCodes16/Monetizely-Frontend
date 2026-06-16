import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { computeQuoteLineItems, computeBaseProductCost, getTermConfig } from '@/lib/pricing'
import type { AddOnInput, QuoteResult } from '@/lib/pricing'
import { API_URL, resolveBasePrice } from '@/lib/api'

interface TierFeature {
    tierName: string
    availability: 'included' | 'addon' | 'not_available'
    pricingModel?: 'fixed' | 'per_seat' | 'percentage'
    price?: number
}

interface Feature {
    name: string
    tiers: TierFeature[]
}

interface Tier {
    name: string
    basePrice: { value: number; frequency: string }
}

interface Product {
    _id: string
    name: string
    tiers: Tier[]
    features: Feature[]
}

interface SelectedAddOn extends AddOnInput {
    enabled: boolean
}

const STEPS = ['Product', 'Configuration', 'Add-ons', 'Review']

export default function QuoteBuilder() {
    const navigate = useNavigate()
    const [step, setStep] = useState(0)
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [initialLoadDone, setInitialLoadDone] = useState(false)
    const [totalProducts, setTotalProducts] = useState(0)

    // Pagination state
    const [_page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const sentinelRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const PAGE_SIZE = 10

    // Form state
    const [quoteName, setQuoteName] = useState('')
    const [customerName, setCustomerName] = useState('')
    const [selectedProductId, setSelectedProductId] = useState('')
    const [selectedTierName, setSelectedTierName] = useState('')
    const [seatsInput, setSeatsInput] = useState('1')
    const seats = Number(seatsInput) || 0
    const [termLength, setTermLength] = useState<'monthly' | 'annual' | 'two_year'>('monthly')
    const [addOns, setAddOns] = useState<SelectedAddOn[]>([])
    const [discountInput, setDiscountInput] = useState('')
    const overallDiscount = Number(discountInput) || 0
    const [saving, setSaving] = useState(false)
    const [fetchError, setFetchError] = useState('')
    const [saveError, setSaveError] = useState('')

    const selectedProduct = products.find(p => p._id === selectedProductId)
    const selectedTier = selectedProduct?.tiers.find(t => t.name === selectedTierName)

    // Fetch products with pagination
    const fetchProducts = useCallback(async (pageNum: number, append: boolean) => {
        if (append) setLoadingMore(true)
        else setLoading(true)
        setFetchError('')

        try {
            const params = new URLSearchParams({
                page: String(pageNum),
                limit: String(PAGE_SIZE),
            })

            const res = await fetch(`${API_URL}/products?${params}`)
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || 'Failed to load products')
            }
            const data = await res.json()

            if (append) {
                setProducts(prev => [...prev, ...data.products])
            } else {
                setProducts(data.products)
            }
            setTotalProducts(data.total)
            setHasMore(pageNum < data.totalPages)
        } catch (err) {
            setFetchError(err instanceof Error ? err.message : 'Failed to load products')
        } finally {
            setLoading(false)
            setLoadingMore(false)
            setInitialLoadDone(true)
        }
    }, [])

    // Initial fetch
    useEffect(() => {
        fetchProducts(1, false)
    }, [fetchProducts])

    // IntersectionObserver for infinite scroll
    useEffect(() => {
        const sentinel = sentinelRef.current
        if (!sentinel) return

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
                    setPage(prev => {
                        const next = prev + 1
                        fetchProducts(next, true)
                        return next
                    })
                }
            },
            { root: scrollContainerRef.current, threshold: 0.1 },
        )

        observer.observe(sentinel)
        return () => observer.disconnect()
    }, [hasMore, loadingMore, loading, fetchProducts])

    // When product/tier changes, rebuild available add-ons
    useEffect(() => {
        if (!selectedProduct || !selectedTierName) {
            setAddOns([])
            return
        }

        const available: SelectedAddOn[] = []
        for (const feature of selectedProduct.features) {
            const tierConfig = feature.tiers.find(t => t.tierName === selectedTierName)
            if (tierConfig?.availability === 'addon' && tierConfig.pricingModel && tierConfig.price !== undefined) {
                available.push({
                    enabled: false,
                    featureName: feature.name,
                    pricingModel: tierConfig.pricingModel,
                    price: tierConfig.price,
                    seats: tierConfig.pricingModel === 'per_seat' ? 1 : undefined,
                })
            }
        }
        setAddOns(available)
    }, [selectedProduct, selectedTierName])

    const preview: QuoteResult | null = useMemo(() => {
        if (!selectedProduct || !selectedTier) return null
        const enabledAddOns: AddOnInput[] = addOns
            .filter(a => a.enabled)
            .map(a => ({
                featureName: a.featureName,
                pricingModel: a.pricingModel,
                price: a.price,
                seats: a.seats,
            }))

        return computeQuoteLineItems({
            productName: selectedProduct.name,
            tierName: selectedTierName,
            basePrice: resolveBasePrice(selectedTier.basePrice),
            seats,
            termLength,
            addOns: enabledAddOns,
            overallDiscount: overallDiscount > 0 ? overallDiscount : undefined,
        })
    }, [selectedProduct, selectedTier, selectedTierName, seats, termLength, addOns, overallDiscount])

    function toggleAddOn(index: number) {
        const updated = [...addOns]
        updated[index] = { ...updated[index], enabled: !updated[index].enabled }
        setAddOns(updated)
    }

    function updateAddOnSeats(index: number, value: number) {
        const updated = [...addOns]
        updated[index] = { ...updated[index], seats: value }
        setAddOns(updated)
    }

    async function handleSave() {
        if (!selectedProduct || !selectedTier || !preview) return
        setSaving(true)
        setSaveError('')

        try {
            const payload = {
                quoteName,
                customerName,
                productId: selectedProduct._id,
                productName: selectedProduct.name,
                tierName: selectedTierName,
                basePrice: resolveBasePrice(selectedTier.basePrice),
                seats,
                termLength,
                addOns: addOns
                    .filter(a => a.enabled)
                    .map(a => ({
                        featureName: a.featureName,
                        pricingModel: a.pricingModel,
                        price: a.price,
                        seats: a.seats,
                    })),
                overallDiscount: overallDiscount > 0 ? overallDiscount : undefined,
            }

            const res = await fetch(`${API_URL}/quotes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || 'Failed to save quote')
            }

            const quote = await res.json()
            navigate(`/quotes/${quote.slug}`)
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Failed to save quote')
        } finally {
            setSaving(false)
        }
    }

    function canProceed(): boolean {
        switch (step) {
            case 0:
                return !!quoteName && !!customerName && !!selectedProductId && !!selectedTierName
            case 1:
                return seats > 0
            case 2:
                return true
            default:
                return true
        }
    }

    if (loading) {
        return <div className="text-center py-10 text-gray-500">Loading products...</div>
    }

    if (initialLoadDone && totalProducts === 0) {
        return (
            <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
                <p className="text-gray-500 mb-4">No products in catalog. Create a product first.</p>
                <button
                    onClick={() => navigate('/catalog/new')}
                    className="text-indigo-600 font-medium hover:text-indigo-700"
                >
                    Create Product
                </button>
            </div>
        )
    }

    return (
        <div>
            {/* Step Indicator */}
            <div className="flex items-center gap-2 mb-8">
                {STEPS.map((s, i) => (
                    <div key={s} className="flex items-center">
                        <button
                            onClick={() => i < step && setStep(i)}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                                i === step
                                    ? 'bg-indigo-600 text-white'
                                    : i < step
                                        ? 'bg-indigo-100 text-indigo-700 cursor-pointer hover:bg-indigo-200'
                                        : 'bg-gray-100 text-gray-400'
                            }`}
                        >
                            {s}
                        </button>
                        {i < STEPS.length - 1 && (
                            <div className="w-8 h-px bg-gray-300 mx-1"></div>
                        )}
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
                {/* Step 0: Product Selection */}
                {step === 0 && (
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">New Quote</h2>
                            <p className="text-sm text-gray-500 mt-1">Fill in the details and pick a product to get started.</p>
                        </div>

                        {fetchError && (
                            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                {fetchError}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Quote Name</label>
                                <input
                                    type="text"
                                    value={quoteName}
                                    onChange={e => setQuoteName(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400"
                                    placeholder="e.g. Acme Corp - Q3 2026 proposal"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Customer Name</label>
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={e => setCustomerName(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400"
                                    placeholder="e.g. Acme Corp"
                                />
                            </div>
                        </div>

                        <div className="border-t border-gray-100 pt-6">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Select a Product</label>
                            <p className="text-xs text-gray-400 mb-4">Pick the product you want to quote, then choose a tier.</p>

                            <div ref={scrollContainerRef} className="min-h-[200px] max-h-[400px] overflow-y-auto space-y-3">
                                {products.map(p => {
                                    const isSelected = selectedProductId === p._id
                                    const lowestPrice = Math.min(...p.tiers.map(t => resolveBasePrice(t.basePrice)))
                                    const highestPrice = Math.max(...p.tiers.map(t => resolveBasePrice(t.basePrice)))
                                    const featureCount = p.features.length
                                    const addonCount = p.features.filter(f =>
                                        f.tiers.some(t => t.availability === 'addon')
                                    ).length

                                    return (
                                        <button
                                            key={p._id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedProductId(p._id)
                                                setSelectedTierName('')
                                            }}
                                            className={`w-full text-left rounded-xl border-2 transition-all duration-200 ${
                                                isSelected
                                                    ? 'border-indigo-500 bg-gradient-to-r from-indigo-50 to-white shadow-md ring-1 ring-indigo-200'
                                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                                            }`}
                                        >
                                            <div className="p-5">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                                                        isSelected
                                                            ? 'bg-indigo-600 text-white shadow-sm'
                                                            : 'bg-gray-100 text-gray-400'
                                                    }`}>
                                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                        </svg>
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-base font-semibold text-gray-900">{p.name}</span>
                                                            {isSelected && (
                                                                <svg className="w-5 h-5 text-indigo-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <span className="text-sm font-mono font-medium text-gray-700">
                                                                ${lowestPrice}{lowestPrice !== highestPrice && <>&ndash;${highestPrice}</>}
                                                                <span className="text-gray-400 font-sans text-xs"> /seat/mo</span>
                                                            </span>
                                                            <span className="text-gray-300">|</span>
                                                            <span className="text-xs text-gray-500">{p.tiers.length} tier{p.tiers.length !== 1 ? 's' : ''}</span>
                                                            {featureCount > 0 && (
                                                                <>
                                                                    <span className="text-gray-300">|</span>
                                                                    <span className="text-xs text-gray-500">{featureCount} feature{featureCount !== 1 ? 's' : ''}</span>
                                                                </>
                                                            )}
                                                            {addonCount > 0 && (
                                                                <>
                                                                    <span className="text-gray-300">|</span>
                                                                    <span className="text-xs text-gray-500">{addonCount} add-on{addonCount !== 1 ? 's' : ''}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                                        {p.tiers.map(t => (
                                                            <span key={t.name} className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors ${
                                                                isSelected
                                                                    ? 'bg-indigo-100 text-indigo-700'
                                                                    : 'bg-gray-100 text-gray-500'
                                                            }`}>
                                                                {t.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    )
                                })}

                                {/* Sentinel for infinite scroll */}
                                <div ref={sentinelRef} className="h-1" />

                                {loadingMore && (
                                    <div className="flex justify-center py-3">
                                        <svg className="w-5 h-5 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                    </div>
                                )}
                            </div>

                            {!loading && products.length === 0 && (
                                <div className="text-center py-8 text-gray-500 text-sm">
                                    No products found.
                                </div>
                            )}
                        </div>

                        {selectedProduct && (
                            <div className="border-t border-gray-100 pt-6">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Choose a tier for <span className="text-indigo-600 font-semibold">{selectedProduct.name}</span>
                                </label>
                                <p className="text-xs text-gray-400 mb-4">Each tier includes different features and pricing.</p>

                                <div className={`grid gap-4 ${selectedProduct.tiers.length <= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                    {selectedProduct.tiers.map((tier, i) => {
                                        const isSelected = selectedTierName === tier.name
                                        const price = resolveBasePrice(tier.basePrice)
                                        const includedFeatures = selectedProduct.features.filter(f => {
                                            const tc = f.tiers.find(t => t.tierName === tier.name)
                                            return tc?.availability === 'included'
                                        })
                                        const addonFeatures = selectedProduct.features.filter(f => {
                                            const tc = f.tiers.find(t => t.tierName === tier.name)
                                            return tc?.availability === 'addon'
                                        })
                                        const tierAccents = [
                                            { gradient: 'from-gray-50 to-gray-50/50', accent: 'text-gray-600' },
                                            { gradient: 'from-blue-50 to-blue-50/30', accent: 'text-blue-600' },
                                            { gradient: 'from-violet-50 to-violet-50/30', accent: 'text-violet-600' },
                                        ]
                                        const color = tierAccents[Math.min(i, tierAccents.length - 1)]

                                        return (
                                            <button
                                                key={tier.name}
                                                type="button"
                                                onClick={() => setSelectedTierName(tier.name)}
                                                className={`relative rounded-xl border-2 text-left transition-all duration-200 overflow-hidden ${
                                                    isSelected
                                                        ? 'border-indigo-500 shadow-lg ring-1 ring-indigo-200 scale-[1.02]'
                                                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                                }`}
                                            >
                                                {isSelected && (
                                                    <div className="absolute top-0 left-0 right-0 bg-indigo-600 text-white text-[10px] font-bold text-center py-0.5 uppercase tracking-widest">
                                                        Selected
                                                    </div>
                                                )}

                                                <div className={`p-5 ${isSelected ? 'pt-7' : ''} bg-gradient-to-b ${isSelected ? 'from-indigo-50 to-white' : color.gradient}`}>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className={`text-xs font-bold uppercase tracking-wider ${isSelected ? 'text-indigo-600' : color.accent}`}>
                                                            {tier.name}
                                                        </span>
                                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                                            isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
                                                        }`}>
                                                            {isSelected && (
                                                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-baseline gap-1 mb-4">
                                                        <span className="text-3xl font-bold text-gray-900 font-mono">${price}</span>
                                                        <span className="text-xs text-gray-400">/seat/mo</span>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        {includedFeatures.slice(0, 3).map(f => (
                                                            <div key={f.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                                                                <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                </svg>
                                                                <span className="truncate">{f.name}</span>
                                                            </div>
                                                        ))}
                                                        {includedFeatures.length > 3 && (
                                                            <div className="text-[11px] text-gray-400 pl-5">
                                                                +{includedFeatures.length - 3} more included
                                                            </div>
                                                        )}
                                                        {addonFeatures.length > 0 && (
                                                            <div className="text-[11px] text-indigo-500 pl-5 font-medium">
                                                                {addonFeatures.length} optional add-on{addonFeatures.length !== 1 ? 's' : ''}
                                                            </div>
                                                        )}
                                                        {includedFeatures.length === 0 && addonFeatures.length === 0 && (
                                                            <div className="text-[11px] text-gray-400">No features configured</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 1: Configuration */}
                {step === 1 && (() => {
                    const basePrice = selectedTier ? resolveBasePrice(selectedTier.basePrice) : 0
                    const hasCost = seats > 0 && basePrice > 0

                    return (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Configuration</h2>
                                {selectedProduct && selectedTier && (
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        {selectedProduct.name} &middot; {selectedTierName} &middot; ${basePrice}/seat/mo
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Number of Seats</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        min="1"
                                        value={seatsInput}
                                        onFocus={e => e.target.select()}
                                        onChange={e => setSeatsInput(e.target.value)}
                                        onBlur={() => { if (!seatsInput || Number(seatsInput) < 1) setSeatsInput('1') }}
                                        className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                    {hasCost && (
                                        <span className="text-sm text-gray-400">
                                            {seats} &times; ${basePrice}/mo
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Term Length</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { value: 'monthly' as const, label: 'Monthly', months: 1, discount: 0 },
                                        { value: 'annual' as const, label: 'Annual', months: 12, discount: 15 },
                                        { value: 'two_year' as const, label: '2-Year', months: 24, discount: 25 },
                                    ].map(term => {
                                        const termConfig = getTermConfig(term.value)
                                        const cost = hasCost
                                            ? computeBaseProductCost(basePrice, seats, termConfig.multiplier, termConfig.discount)
                                            : 0
                                        const isSelected = termLength === term.value
                                        const monthlyCost = hasCost
                                            ? computeBaseProductCost(basePrice, seats, 1, 0)
                                            : 0
                                        const savings = hasCost && term.discount > 0
                                            ? (monthlyCost * term.months) - cost
                                            : 0

                                        return (
                                            <button
                                                key={term.value}
                                                type="button"
                                                onClick={() => setTermLength(term.value)}
                                                className={`relative rounded-xl border-2 text-left transition-all ${
                                                    isSelected
                                                        ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                                }`}
                                            >
                                                {term.discount > 0 && (
                                                    <div className={`absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                        isSelected
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                        {term.discount}% off
                                                    </div>
                                                )}

                                                <div className="p-4 pb-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                                            isSelected ? 'border-indigo-600' : 'border-gray-300'
                                                        }`}>
                                                            {isSelected && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                                                        </div>
                                                        <span className="font-semibold text-gray-900">{term.label}</span>
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1 ml-6">
                                                        {term.months} month{term.months !== 1 ? 's' : ''}
                                                    </div>
                                                </div>

                                                <div className={`px-4 py-3 rounded-b-[10px] ${
                                                    isSelected ? 'bg-indigo-100/60' : 'bg-gray-50'
                                                }`}>
                                                    <div className={`text-xl font-bold font-mono ${hasCost ? 'text-gray-900' : 'text-gray-300'}`}>
                                                        {hasCost ? `$${cost.toLocaleString()}` : '\u2014'}
                                                    </div>
                                                    {hasCost && savings > 0 ? (
                                                        <div className="text-xs font-medium text-green-600 mt-0.5">
                                                            Save ${savings.toLocaleString()}
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-gray-400 mt-0.5">
                                                            {hasCost ? 'base product cost' : 'enter seats to see cost'}
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )
                })()}

                {/* Step 2: Add-ons */}
                {step === 2 && (() => {
                    const enabledAddOns = addOns.filter(a => a.enabled)
                    const addOnsMonthlyCost = enabledAddOns.reduce((sum, a) => {
                        if (a.pricingModel === 'fixed') return sum + a.price
                        if (a.pricingModel === 'per_seat') return sum + a.price * (a.seats || 1)
                        return sum
                    }, 0)

                    return (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Add-ons & Discount</h2>
                                {selectedProduct && (
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        {selectedProduct.name} &middot; {selectedTierName} &middot; {addOns.length} available add-on{addOns.length !== 1 ? 's' : ''}
                                    </p>
                                )}
                            </div>

                            {addOns.length === 0 ? (
                                <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
                                    <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                    </svg>
                                    <p className="text-gray-500 text-sm font-medium">No add-ons available</p>
                                    <p className="text-gray-400 text-xs mt-1">This product/tier has no optional add-ons configured.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    {addOns.map((addon, i) => {
                                        const addonMonthly = addon.pricingModel === 'fixed'
                                            ? addon.price
                                            : addon.pricingModel === 'per_seat'
                                                ? addon.price * (addon.seats || 1)
                                                : 0

                                        return (
                                            <div
                                                key={addon.featureName}
                                                className={`relative rounded-xl border-2 transition-all duration-200 flex flex-col ${
                                                    addon.enabled
                                                        ? 'border-indigo-500 shadow-md ring-1 ring-indigo-200'
                                                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                                                }`}
                                            >
                                                {/* Header band */}
                                                {addon.enabled && (
                                                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-t-[10px]" />
                                                )}

                                                {/* Card body */}
                                                <div
                                                    className={`p-5 cursor-pointer flex-1 ${addon.enabled ? 'bg-gradient-to-b from-indigo-50/80 to-white' : ''}`}
                                                    onClick={() => toggleAddOn(i)}
                                                >
                                                    <div className="flex items-start justify-between mb-3">
                                                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                                                            addon.pricingModel === 'fixed'
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : addon.pricingModel === 'per_seat'
                                                                    ? 'bg-blue-100 text-blue-700'
                                                                    : 'bg-amber-100 text-amber-700'
                                                        }`}>
                                                            {addon.pricingModel === 'fixed' && 'Flat fee'}
                                                            {addon.pricingModel === 'per_seat' && 'Per seat'}
                                                            {addon.pricingModel === 'percentage' && 'Percentage'}
                                                        </span>

                                                        {/* Checkbox */}
                                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                                            addon.enabled ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
                                                        }`}>
                                                            {addon.enabled && (
                                                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <h3 className="text-sm font-semibold text-gray-900 mb-1">{addon.featureName}</h3>

                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-2xl font-bold font-mono text-gray-900">
                                                            {addon.pricingModel === 'percentage' ? `${addon.price}%` : `$${addon.price}`}
                                                        </span>
                                                        <span className="text-xs text-gray-400">
                                                            {addon.pricingModel === 'fixed' && '/month'}
                                                            {addon.pricingModel === 'per_seat' && '/seat/mo'}
                                                            {addon.pricingModel === 'percentage' && 'of base'}
                                                        </span>
                                                    </div>

                                                    {/* Live cost for enabled non-percentage add-ons */}
                                                    {addon.enabled && addon.pricingModel !== 'percentage' && (
                                                        <div className="mt-2 text-xs font-medium text-indigo-600 font-mono">
                                                            Total: ${addonMonthly.toLocaleString()}/mo
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Per-seat stepper */}
                                                {addon.enabled && addon.pricingModel === 'per_seat' && (
                                                    <div className="px-5 pb-4" onClick={e => e.stopPropagation()}>
                                                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Seats</span>
                                                                <span className="text-xs text-blue-500 font-mono">
                                                                    {addon.seats || 1} &times; ${addon.price} = ${addonMonthly}/mo
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateAddOnSeats(i, Math.max(1, (addon.seats || 1) - 1))}
                                                                    className="w-9 h-9 rounded-lg border border-blue-200 bg-white flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors font-bold text-lg"
                                                                >
                                                                    -
                                                                </button>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    value={addon.seats || 1}
                                                                    onFocus={e => e.target.select()}
                                                                    onChange={e => updateAddOnSeats(i, Math.max(1, Number(e.target.value) || 1))}
                                                                    className="flex-1 text-center h-9 text-sm font-mono font-bold text-gray-900 border border-blue-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateAddOnSeats(i, (addon.seats || 1) + 1)}
                                                                    className="w-9 h-9 rounded-lg border border-blue-200 bg-white flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors font-bold text-lg"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Cost summary bar */}
                            {enabledAddOns.length > 0 && (
                                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-violet-50 rounded-xl border border-indigo-100">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm text-indigo-700 font-medium">
                                            {enabledAddOns.length} add-on{enabledAddOns.length !== 1 ? 's' : ''} selected
                                        </span>
                                    </div>
                                    {addOnsMonthlyCost > 0 && (
                                        <span className="text-sm font-mono font-bold text-indigo-700">
                                            +${addOnsMonthlyCost.toLocaleString()}/mo
                                        </span>
                                    )}
                                </div>
                            )}

                            <div className="border-t border-gray-100 pt-5">
                                <div className={`rounded-xl border-2 transition-all duration-200 ${
                                    overallDiscount > 0
                                        ? 'border-green-500 bg-gradient-to-r from-green-50 to-emerald-50/50 ring-1 ring-green-200'
                                        : 'border-gray-200 bg-white'
                                }`}>
                                    <div className="p-5">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                                                overallDiscount > 0 ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'
                                            }`}>
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-semibold text-gray-900">Overall Discount</h3>
                                                <p className="text-xs text-gray-400">Applied to the final total after all add-ons</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                                                <button
                                                    type="button"
                                                    onClick={() => setDiscountInput(String(Math.max(0, overallDiscount - 1)))}
                                                    className={`px-3 py-2.5 font-bold text-sm transition-colors ${
                                                        overallDiscount > 0 ? 'text-green-600 hover:bg-green-50' : 'text-gray-300 cursor-not-allowed'
                                                    }`}
                                                    disabled={overallDiscount <= 0}
                                                >
                                                    -
                                                </button>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={discountInput}
                                                    onFocus={e => e.target.select()}
                                                    onChange={e => {
                                                        const val = e.target.value.replace(/[^0-9]/g, '')
                                                        const num = Number(val)
                                                        if (val === '' || num <= 100) setDiscountInput(val)
                                                    }}
                                                    className="w-16 text-center py-2.5 text-sm font-mono font-bold text-gray-900 border-x border-gray-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                                                    placeholder="0"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setDiscountInput(String(Math.min(100, overallDiscount + 1)))}
                                                    className={`px-3 py-2.5 font-bold text-sm transition-colors ${
                                                        overallDiscount < 100 ? 'text-green-600 hover:bg-green-50' : 'text-gray-300 cursor-not-allowed'
                                                    }`}
                                                    disabled={overallDiscount >= 100}
                                                >
                                                    +
                                                </button>
                                            </div>
                                            <span className="text-sm font-semibold text-gray-500">%</span>
                                        </div>

                                        {overallDiscount > 0 && preview && (
                                            <div className="mt-3 flex items-center gap-2 text-xs font-medium text-green-700">
                                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                                </svg>
                                                {overallDiscount}% discount applied to final total
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })()}

                {/* Step 3: Review */}
                {step === 3 && preview && (
                    <div className="space-y-5">
                        <h2 className="text-lg font-semibold text-gray-900">Review Quote</h2>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500">Quote:</span>{' '}
                                <span className="font-medium">{quoteName}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Customer:</span>{' '}
                                <span className="font-medium">{customerName}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Product:</span>{' '}
                                <span className="font-medium">{selectedProduct?.name} - {selectedTierName}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Seats:</span>{' '}
                                <span className="font-medium">{seats}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Term:</span>{' '}
                                <span className="font-medium">{getTermConfig(termLength).label}</span>
                            </div>
                        </div>

                        <div className="border-t border-gray-200 pt-4">
                            <h3 className="font-medium text-gray-900 mb-3">Line Items</h3>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="text-left py-2 font-medium text-gray-500">Item</th>
                                        <th className="text-left py-2 font-medium text-gray-500">Calculation</th>
                                        <th className="text-right py-2 font-medium text-gray-500">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.lineItems.map((item, i) => (
                                        <tr key={i} className="border-b border-gray-100">
                                            <td className="py-2 text-gray-900">{item.label}</td>
                                            <td className="py-2 text-gray-500">{item.calculation}</td>
                                            <td className={`py-2 text-right font-mono ${item.amount < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                                {item.amount < 0 ? '-' : ''}${Math.abs(item.amount).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-gray-300">
                                        <td className="py-3 font-bold text-gray-900" colSpan={2}>Total</td>
                                        <td className="py-3 text-right font-bold text-gray-900 font-mono text-lg">
                                            ${preview.total.toLocaleString()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}

                {saveError && (
                    <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mt-4">
                        {saveError}
                    </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between mt-8 pt-4 border-t border-gray-100">
                    <button
                        onClick={() => step > 0 ? setStep(step - 1) : navigate('/quotes')}
                        className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
                    >
                        {step === 0 ? 'Cancel' : 'Back'}
                    </button>

                    {step < STEPS.length - 1 ? (
                        <button
                            onClick={() => setStep(step + 1)}
                            disabled={!canProceed()}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            Next
                        </button>
                    ) : (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                            {saving ? 'Saving...' : 'Save & Share Quote'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
