import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL } from '@/lib/api'

interface Tier {
    name: string
    basePrice: number | string
}

const TIER_COLORS = [
    'border-gray-200 bg-gray-50/50',
    'border-blue-200 bg-blue-50/30',
    'border-indigo-200 bg-indigo-50/50 ring-1 ring-indigo-100',
]

export default function NewProductPage() {
    const navigate = useNavigate()
    const [name, setName] = useState('')
    const [tiers, setTiers] = useState<Tier[]>([
        { name: 'Starter', basePrice: '' },
        { name: 'Growth', basePrice: '' },
        { name: 'Enterprise', basePrice: '' },
    ])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    function updateTier(index: number, field: keyof Tier, value: string) {
        const updated = [...tiers]
        if (field === 'basePrice') {
            updated[index] = { ...updated[index], basePrice: value }
        } else {
            updated[index] = { ...updated[index], [field]: value }
        }
        setTiers(updated)
    }

    function addTier() {
        setTiers([...tiers, { name: '', basePrice: '' }])
    }

    function removeTier(index: number) {
        if (tiers.length <= 1) return
        setTiers(tiers.filter((_, i) => i !== index))
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setSaving(true)

        const payload = {
            name,
            tiers: tiers
                .filter(t => t.name && t.basePrice !== '')
                .map(t => ({ name: t.name, basePrice: { value: Number(t.basePrice), frequency: 'monthly' } })),
        }

        if (payload.tiers.length === 0) {
            setError('At least one tier with a name and price is required')
            setSaving(false)
            return
        }

        try {
            const res = await fetch(`${API_URL}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                setError(data.error || 'Failed to create product')
                setSaving(false)
                return
            }

            const product = await res.json()
            navigate(`/catalog/${product._id}`)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create product')
            setSaving(false)
        }
    }

    return (
        <div>
            {/* Top bar */}
            <div className="flex items-center justify-between mb-8">
                <button
                    onClick={() => navigate('/catalog')}
                    className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Catalog
                </button>
            </div>

            <form onSubmit={handleSubmit}>
                {/* Product details card */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                    <div className="px-6 py-5 border-b border-gray-100">
                        <h1 className="text-lg font-semibold text-gray-900">Create New Product</h1>
                        <p className="text-sm text-gray-500 mt-0.5">Define your product and configure pricing tiers.</p>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Product name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Product Name
                            </label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400"
                                placeholder="e.g. Analytics Suite, CRM Pro..."
                            />
                        </div>
                    </div>
                </div>

                {/* Pricing tiers card */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                    <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Pricing Tiers</h2>
                            <p className="text-sm text-gray-500 mt-0.5">Add at least one tier. Prices are per seat per month.</p>
                        </div>
                        <button
                            type="button"
                            onClick={addTier}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            Add Tier
                        </button>
                    </div>

                    <div className="p-6">
                        <div className="grid grid-cols-1 gap-4">
                            {tiers.map((tier, i) => (
                                <div
                                    key={i}
                                    className={`rounded-xl border p-5 transition-colors ${TIER_COLORS[Math.min(i, TIER_COLORS.length - 1)]}`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <span className="text-xs font-bold text-gray-500">{i + 1}</span>
                                        </div>
                                        <div className="flex-1 grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Tier Name</label>
                                                <input
                                                    type="text"
                                                    value={tier.name}
                                                    onChange={e => updateTier(i, 'name', e.target.value)}
                                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400"
                                                    placeholder="e.g. Starter, Growth, Enterprise"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Base Price / Seat / Mo</label>
                                                <div className="relative">
                                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">$</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={tier.basePrice}
                                                        onChange={e => updateTier(i, 'basePrice', e.target.value)}
                                                        className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        {tiers.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeTier(i)}
                                                className="w-8 h-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 inline-flex items-center justify-center transition-colors flex-shrink-0 mt-0.5"
                                                title="Remove tier"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-6 flex items-center gap-3 text-sm text-red-700 bg-red-50 border border-red-200 px-5 py-3.5 rounded-xl">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                        {error}
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => navigate('/catalog')}
                        className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving || !name.trim()}
                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm inline-flex items-center gap-2"
                    >
                        {saving ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Creating...
                            </>
                        ) : (
                            'Create Product'
                        )}
                    </button>
                </div>
            </form>
        </div>
    )
}
