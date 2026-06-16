import { useEffect, useState } from 'react'
import { API_URL } from '@/lib/api'

interface LineItem {
    label: string
    calculation: string
    notes: string
    amount: number
}

interface Quote {
    slug: string
    quoteName: string
    customerName: string
    productSnapshot: {
        productName: string
        tierName: string
        basePrice: number
    }
    seats: number
    termLength: string
    termMultiplier: number
    discountPercent: number
    addOns: {
        featureName: string
        pricingModel: string
        price: number
        seats?: number
    }[]
    overallDiscount?: number
    lineItems: LineItem[]
    total: number
    createdAt: string
}

const TERM_LABELS: Record<string, string> = {
    monthly: 'Monthly',
    annual: 'Annual',
    two_year: '2-Year',
}

function formatTermDescription(quote: Quote): string {
    const label = TERM_LABELS[quote.termLength] || quote.termLength
    const parts = [`${label} (${quote.termMultiplier} month${quote.termMultiplier !== 1 ? 's' : ''}`]
    if (quote.discountPercent > 0) {
        parts[0] += `, ${quote.discountPercent}% discount applies to per-seat price`
    }
    parts[0] += ')'
    return parts[0]
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    })
}

function getValidUntil(dateStr: string): string {
    const d = new Date(dateStr)
    d.setDate(d.getDate() + 30)
    return formatDate(d.toISOString())
}

export default function QuoteView({ slug }: { slug: string }) {
    const [quote, setQuote] = useState<Quote | null>(null)
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        fetch(`${API_URL}/quotes/${slug}`)
            .then(res => {
                if (!res.ok) {
                    setNotFound(true)
                    setLoading(false)
                    return null
                }
                return res.json()
            })
            .then(data => {
                if (data) {
                    setQuote(data)
                    setLoading(false)
                }
            })
            .catch(err => {
                setError(err instanceof Error ? err.message : 'Failed to load quote')
                setLoading(false)
            })
    }, [slug])

    if (loading) {
        return <div className="text-center py-10 text-gray-500">Loading quote...</div>
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto">
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {error}
                </div>
            </div>
        )
    }

    if (notFound || !quote) {
        return <div className="text-center py-10 text-red-500">Quote not found</div>
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Actions bar — hidden on print */}
            <div className="flex items-center justify-between mb-6 print:hidden">
                <div className="text-sm text-gray-400">Quote ID: <span className="font-mono text-gray-600">{quote.slug}</span></div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => window.print()}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors inline-flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                        </svg>
                        Print / PDF
                    </button>
                </div>
            </div>

            {/* Quote document */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:shadow-none print:border-0">
                {/* Title header */}
                <div className="px-8 pt-8 pb-6 border-b border-gray-100">
                    <h1 className="text-2xl font-bold text-gray-900">{quote.quoteName}</h1>
                </div>

                {/* Quote details */}
                <div className="px-8 py-6 border-b border-gray-100">
                    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Quote Details</h2>
                    <div className="grid grid-cols-2 gap-y-3 gap-x-8 text-sm max-w-lg">
                        <div className="text-gray-500">Customer</div>
                        <div className="text-gray-900 font-medium">{quote.customerName}</div>
                        <div className="text-gray-500">Quote name</div>
                        <div className="text-gray-900 font-medium">{quote.quoteName}</div>
                        <div className="text-gray-500">Quote date</div>
                        <div className="text-gray-900 font-medium">{formatDate(quote.createdAt)}</div>
                        <div className="text-gray-500">Valid until</div>
                        <div className="text-gray-900 font-medium">{getValidUntil(quote.createdAt)}</div>
                    </div>
                </div>

                {/* What is being purchased */}
                <div className="px-8 py-6 border-b border-gray-100">
                    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">What is Being Purchased</h2>
                    <div className="grid grid-cols-2 gap-y-3 gap-x-8 text-sm max-w-lg">
                        <div className="text-gray-500">Product</div>
                        <div className="text-gray-900 font-medium">{quote.productSnapshot.productName}</div>
                        <div className="text-gray-500">Tier</div>
                        <div className="text-gray-900 font-medium">{quote.productSnapshot.tierName}</div>
                        <div className="text-gray-500">Seats</div>
                        <div className="text-gray-900 font-medium">{quote.seats}</div>
                        <div className="text-gray-500">Term length</div>
                        <div className="text-gray-900 font-medium">{formatTermDescription(quote)}</div>
                    </div>
                </div>

                {/* Cost breakdown */}
                <div className="px-8 py-6">
                    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Cost Breakdown</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b-2 border-gray-200">
                                    <th className="text-left py-3 pr-4 font-semibold text-gray-700">Line item</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-700">How it was calculated</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-700 hidden md:table-cell">Notes</th>
                                    <th className="text-right py-3 pl-4 font-semibold text-gray-700 whitespace-nowrap">Amount (USD)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {quote.lineItems.map((item, i) => (
                                    <tr key={i} className="border-b border-gray-100">
                                        <td className="py-3.5 pr-4 text-gray-900 font-medium align-top">{item.label}</td>
                                        <td className="py-3.5 px-4 text-gray-600 align-top">{item.calculation}</td>
                                        <td className="py-3.5 px-4 text-gray-400 hidden md:table-cell align-top">{item.notes}</td>
                                        <td className={`py-3.5 pl-4 text-right font-mono font-medium whitespace-nowrap align-top ${item.amount < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                            {item.amount < 0 ? '-' : ''}${Math.abs(item.amount).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-gray-300">
                                    <td className="py-4 pr-4 font-bold text-gray-900 text-base" colSpan={3}>TOTAL</td>
                                    <td className="py-4 pl-4 text-right font-bold text-gray-900 font-mono text-lg">
                                        ${quote.total.toLocaleString()}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
