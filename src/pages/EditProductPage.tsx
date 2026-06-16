import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import FeatureMatrixEditor from '@/components/FeatureMatrixEditor'
import { API_URL } from '@/lib/api'

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

interface Product {
    _id: string
    name: string
    tiers: Tier[]
    features: Feature[]
}

export default function EditProductPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [product, setProduct] = useState<Product | null>(null)
    const [features, setFeatures] = useState<Feature[]>([])
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [saveError, setSaveError] = useState('')

    useEffect(() => {
        fetch(`${API_URL}/products/${id}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to load product')
                return res.json()
            })
            .then(data => {
                setProduct(data)
                setFeatures(data.features || [])
                setLoading(false)
            })
            .catch(err => {
                setError(err instanceof Error ? err.message : 'Failed to load product')
                setLoading(false)
            })
    }, [id])

    async function handleSave() {
        if (!product) return
        setSaving(true)
        setSaved(false)
        setSaveError('')

        try {
            const payload = {
                ...product,
                features: features.map(f => ({
                    ...f,
                    tiers: f.tiers.map(t => ({
                        ...t,
                        price: t.price !== '' && t.price !== undefined ? Number(t.price) : undefined,
                    })),
                })),
            }

            const res = await fetch(`${API_URL}/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || 'Failed to save product')
            }

            const updated = await res.json()
            setProduct(updated)
            setFeatures(updated.features || [])
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Failed to save product')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <div className="text-center py-10 text-gray-500">Loading product...</div>
    }

    if (error) {
        return (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
            </div>
        )
    }

    if (!product) {
        return <div className="text-center py-10 text-red-500">Product not found</div>
    }

    return (
        <div>
            {/* Top bar */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/catalog')}
                        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>
                    <span className="text-gray-300">|</span>
                    <h1 className="text-lg font-semibold text-gray-900">{product.name}</h1>
                </div>
                <div className="flex items-center gap-3">
                    {saveError && (
                        <span className="text-sm text-red-600">{saveError}</span>
                    )}
                    {saved && (
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Saved
                        </span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Feature Matrix */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6">
                    <FeatureMatrixEditor
                        productId={id!}
                        tiers={product.tiers}
                        features={features}
                        onChange={setFeatures}
                    />
                </div>
            </div>
        </div>
    )
}
