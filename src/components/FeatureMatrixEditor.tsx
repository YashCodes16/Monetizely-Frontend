import { useState } from 'react'
import { API_URL, resolveBasePrice } from '@/lib/api'

interface TierFeature {
    tierName: string
    availability: 'included' | 'addon' | 'not_available'
    pricingModel?: 'fixed' | 'per_seat' | 'percentage'
    price?: number | string
}

interface Feature {
    _id?: string
    name: string
    tiers: TierFeature[]
}

interface Tier {
    name: string
    basePrice: { value: number; frequency: string }
}

interface Props {
    productId: string
    tiers: Tier[]
    features: Feature[]
    onChange: (features: Feature[]) => void
}

const AVAILABILITY_STYLES = {
    included: 'bg-green-50 text-green-700 border-green-200',
    addon: 'bg-amber-50 text-amber-700 border-amber-200',
    not_available: 'bg-gray-50 text-gray-500 border-gray-200',
}

export default function FeatureMatrixEditor({ productId, tiers, features, onChange }: Props) {
    const [newFeatureName, setNewFeatureName] = useState('')
    const [deletingIndex, setDeletingIndex] = useState<number | null>(null)

    function addFeature() {
        if (!newFeatureName.trim()) return
        const newFeature: Feature = {
            name: newFeatureName.trim(),
            tiers: tiers.map(t => ({
                tierName: t.name,
                availability: 'not_available' as const,
            })),
        }
        onChange([...features, newFeature])
        setNewFeatureName('')
    }

    async function removeFeature(index: number) {
        const feature = features[index]
        if (!feature._id) {
            onChange(features.filter((_, i) => i !== index))
            return
        }
        setDeletingIndex(index)
        try {
            const res = await fetch(
                `${API_URL}/products/${productId}/features/${feature._id}`,
                { method: 'DELETE' },
            )
            if (res.ok) {
                const updated = await res.json()
                onChange(updated.features || [])
            }
        } catch {
            alert('Failed to delete feature. Please try again.')
        } finally {
            setDeletingIndex(null)
        }
    }

    function updateAvailability(
        featureIndex: number,
        tierIndex: number,
        availability: 'included' | 'addon' | 'not_available',
    ) {
        const updated = [...features]
        const tierFeature = { ...updated[featureIndex].tiers[tierIndex] }
        tierFeature.availability = availability
        if (availability !== 'addon') {
            delete tierFeature.pricingModel
            delete tierFeature.price
        } else {
            tierFeature.pricingModel = tierFeature.pricingModel || 'fixed'
            tierFeature.price = tierFeature.price ?? ''
        }
        updated[featureIndex] = {
            ...updated[featureIndex],
            tiers: updated[featureIndex].tiers.map((t, i) =>
                i === tierIndex ? tierFeature : t
            ),
        }
        onChange(updated)
    }

    function updateAddonPricing(
        featureIndex: number,
        tierIndex: number,
        field: 'pricingModel' | 'price',
        value: string,
    ) {
        const updated = [...features]
        const tierFeature = { ...updated[featureIndex].tiers[tierIndex] }
        if (field === 'pricingModel') {
            tierFeature.pricingModel = value as 'fixed' | 'per_seat' | 'percentage'
        } else {
            tierFeature.price = value
        }
        updated[featureIndex] = {
            ...updated[featureIndex],
            tiers: updated[featureIndex].tiers.map((t, i) =>
                i === tierIndex ? tierFeature : t
            ),
        }
        onChange(updated)
    }

    return (
        <div className="space-y-5">
            {/* Add feature input — top */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={newFeatureName}
                    onChange={e => setNewFeatureName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400"
                    placeholder="Add a feature — e.g. SSO Integration, API Access, Custom Branding..."
                />
                <button
                    onClick={addFeature}
                    disabled={!newFeatureName.trim()}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                    Add
                </button>
            </div>

            {/* Table or empty state */}
            {features.length === 0 ? (
                <div className="text-center py-16 border border-gray-200 rounded-lg bg-gray-50/50">
                    <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                    </svg>
                    <p className="text-sm text-gray-500">No features yet</p>
                    <p className="text-xs text-gray-400 mt-0.5">Type a feature name above and hit Enter.</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full border-collapse table-fixed">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-40 border-b border-gray-200">
                                    Feature
                                </th>
                                {tiers.map((tier, i) => (
                                    <th
                                        key={tier.name}
                                        className={`py-2.5 px-3 text-center border-b border-gray-200 ${i > 0 ? 'border-l border-gray-200' : ''}`}
                                    >
                                        <div className="text-[11px] font-semibold text-gray-900 uppercase tracking-wider">{tier.name}</div>
                                        <div className="text-[10px] text-gray-400 font-normal">${resolveBasePrice(tier.basePrice)}/seat</div>
                                    </th>
                                ))}
                                <th className="w-9 border-b border-gray-200"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {features.map((feature, fi) => (
                                <tr key={fi} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="py-3 px-4 border-b border-gray-100">
                                        <span className="text-sm font-medium text-gray-900">{feature.name}</span>
                                    </td>
                                    {tiers.map((tier, ti) => {
                                        const tf = feature.tiers.find(t => t.tierName === tier.name) || {
                                            tierName: tier.name,
                                            availability: 'not_available' as const,
                                        }
                                        const tierIndex = feature.tiers.findIndex(t => t.tierName === tier.name)
                                        const actualIndex = tierIndex >= 0 ? tierIndex : ti

                                        return (
                                            <td
                                                key={tier.name}
                                                className={`py-3 px-3 border-b border-gray-100 ${ti > 0 ? 'border-l border-gray-100' : ''}`}
                                            >
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <select
                                                        value={tf.availability}
                                                        onChange={e => updateAvailability(fi, actualIndex, e.target.value as 'included' | 'addon' | 'not_available')}
                                                        className={`text-xs font-medium border rounded-full px-3 py-1 cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 transition-colors ${AVAILABILITY_STYLES[tf.availability]}`}
                                                    >
                                                        <option value="not_available">Not Available</option>
                                                        <option value="included">Included</option>
                                                        <option value="addon">Add-on</option>
                                                    </select>
                                                    {tf.availability === 'addon' && (
                                                        <div className="flex flex-col gap-1 items-center">
                                                            <select
                                                                value={tf.pricingModel || 'fixed'}
                                                                onChange={e => updateAddonPricing(fi, actualIndex, 'pricingModel', e.target.value)}
                                                                className="text-[11px] border border-gray-200 rounded-md px-2 py-1 text-gray-600 bg-white focus:ring-2 focus:ring-indigo-500"
                                                            >
                                                                <option value="fixed">Fixed monthly price</option>
                                                                <option value="per_seat">Per-seat price</option>
                                                                <option value="percentage">% of product price</option>
                                                            </select>
                                                            <div className="relative">
                                                                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">
                                                                    {tf.pricingModel === 'percentage' ? '%' : '$'}
                                                                </span>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max={tf.pricingModel === 'percentage' ? 100 : undefined}
                                                                    step="0.01"
                                                                    value={tf.price ?? ''}
                                                                    onChange={e => {
                                                                        const val = e.target.value
                                                                        if (tf.pricingModel === 'percentage' && Number(val) > 100) return
                                                                        updateAddonPricing(fi, actualIndex, 'price', val)
                                                                    }}
                                                                    className="w-20 text-[11px] border border-gray-200 rounded-md pl-4 pr-1.5 py-1 text-gray-700 bg-white focus:ring-2 focus:ring-indigo-500"
                                                                    placeholder="0.00"
                                                                />
                                                            </div>
                                                            <span className="text-[10px] text-gray-400 leading-tight">
                                                                {tf.pricingModel === 'percentage'
                                                                    ? `${tf.price || 0}% of the product cost`
                                                                    : tf.pricingModel === 'per_seat'
                                                                        ? `$${tf.price || 0} per seat per month`
                                                                        : `$${tf.price || 0} per month, flat`}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        )
                                    })}
                                    <td className="py-3 px-1 border-b border-gray-100 text-center">
                                        <button
                                            onClick={() => removeFeature(fi)}
                                            disabled={deletingIndex === fi}
                                            className="w-7 h-7 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center transition-colors"
                                            title="Remove feature"
                                        >
                                            {deletingIndex === fi ? (
                                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                </svg>
                                            ) : (
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            )}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
