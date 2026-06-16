import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { API_URL, resolveBasePrice } from '@/lib/api'

interface TierFeature {
    tierName: string
    availability: 'included' | 'addon' | 'not_available'
    pricingModel?: string
    price?: number
}

interface Feature {
    name: string
    tiers: TierFeature[]
}

interface Product {
    _id: string
    name: string
    tiers: { name: string; basePrice: { value: number; frequency: string } }[]
    features: Feature[]
    createdAt: string
}

function AvailabilityBadge({ tf }: { tf: TierFeature | undefined }) {
    if (!tf || tf.availability === 'not_available') {
        return <span className="text-gray-300">&mdash;</span>
    }
    if (tf.availability === 'included') {
        return (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            </span>
        )
    }
    return (
        <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
            Add-on
        </span>
    )
}

const PRODUCTS_PER_PAGE = 10

export default function CatalogPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)
    const [error, setError] = useState('')

    useEffect(() => {
        setLoading(true)
        setError('')
        fetch(`${API_URL}/products?page=${page}&limit=${PRODUCTS_PER_PAGE}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to load products')
                return res.json()
            })
            .then(data => {
                setProducts(data.products)
                setTotalPages(data.totalPages)
                setTotal(data.total)
                setLoading(false)
            })
            .catch(err => {
                setError(err instanceof Error ? err.message : 'Failed to load products')
                setLoading(false)
            })
    }, [page])

    async function handleDelete(id: string) {
        setDeleting(id)
        setError('')
        try {
            const res = await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to delete product')
            if (products.length === 1 && page > 1) {
                setPage(page - 1)
            } else {
                const refetch = await fetch(`${API_URL}/products?page=${page}&limit=${PRODUCTS_PER_PAGE}`)
                if (!refetch.ok) throw new Error('Failed to refresh product list')
                const data = await refetch.json()
                setProducts(data.products)
                setTotalPages(data.totalPages)
                setTotal(data.total)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete product')
        } finally {
            setDeleting(null)
            setConfirmDeleteId(null)
        }
    }

    if (loading) {
        return <div className="text-center py-10 text-gray-500">Loading products...</div>
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Product Catalog</h1>
                    <p className="text-sm text-gray-500 mt-1">{total} product{total !== 1 ? 's' : ''}</p>
                </div>
                <Link
                    to="/catalog/new"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                >
                    + New Product
                </Link>
            </div>

            {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-6">
                    {error}
                </div>
            )}

            {products.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
                    <p className="text-gray-500 mb-4">No products yet. Create your first product to get started.</p>
                    <Link
                        to="/catalog/new"
                        className="text-indigo-600 font-medium hover:text-indigo-700"
                    >
                        Create Product
                    </Link>
                </div>
            ) : (
                <div className="space-y-8">
                    {products.map(product => {
                        const lowestPrice = Math.min(...product.tiers.map(t => resolveBasePrice(t.basePrice)))
                        const highestPrice = Math.max(...product.tiers.map(t => resolveBasePrice(t.basePrice)))

                        return (
                            <div
                                key={product._id}
                                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                            >
                                {/* Card Header */}
                                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">{product.name}</h2>
                                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                            <span>
                                                ${lowestPrice}{lowestPrice !== highestPrice && <>&ndash;${highestPrice}</>}/seat/mo
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Link
                                            to={`/catalog/${product._id}`}
                                            className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                                        >
                                            Edit &rarr;
                                        </Link>
                                        <button
                                            onClick={() => setConfirmDeleteId(product._id)}
                                            className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>

                                {/* Tier Pricing Columns */}
                                <div className="grid border-b border-gray-100" style={{ gridTemplateColumns: `200px repeat(${product.tiers.length}, 1fr)` }}>
                                    {/* Header row */}
                                    <div className="px-6 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Plan
                                    </div>
                                    {product.tiers.map((tier, i) => (
                                        <div
                                            key={tier.name}
                                            className={`px-4 py-3 bg-gray-50 text-center ${i > 0 ? 'border-l border-gray-100' : ''}`}
                                        >
                                            <div className="text-sm font-semibold text-gray-900">{tier.name}</div>
                                            <div className="mt-0.5">
                                                <span className="text-2xl font-bold text-gray-900">${resolveBasePrice(tier.basePrice)}</span>
                                                <span className="text-xs text-gray-400">/seat/mo</span>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Feature rows */}
                                    {product.features.length > 0 ? (
                                        product.features.map((feature, fi) => (
                                            <div key={fi} className="contents">
                                                <div className={`px-6 py-3 text-sm text-gray-700 flex items-center ${fi > 0 ? 'border-t border-gray-50' : ''}`}>
                                                    {feature.name}
                                                </div>
                                                {product.tiers.map((tier, ti) => {
                                                    const tf = feature.tiers.find(t => t.tierName === tier.name)
                                                    return (
                                                        <div
                                                            key={tier.name}
                                                            className={`px-4 py-3 flex items-center justify-center ${ti > 0 ? 'border-l border-gray-100' : ''} ${fi > 0 ? 'border-t border-gray-50' : ''}`}
                                                        >
                                                            <AvailabilityBadge tf={tf} />
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="contents">
                                            <div className="px-6 py-4 text-sm text-gray-400 italic col-span-full border-t border-gray-50">
                                                No features configured yet
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Card Footer */}
                                <div className="px-6 py-3 bg-gray-50 flex items-center justify-between text-xs text-gray-400">
                                    <span>
                                        {product.tiers.length} tier{product.tiers.length !== 1 ? 's' : ''}
                                        {' \u00b7 '}
                                        {product.features.length} feature{product.features.length !== 1 ? 's' : ''}
                                    </span>
                                    <span>Created {new Date(product.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                        Showing {(page - 1) * PRODUCTS_PER_PAGE + 1}&ndash;{Math.min(page * PRODUCTS_PER_PAGE, total)} of {total}
                    </p>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setPage(page - 1)}
                            disabled={page === 1}
                            className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Previous
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                            <button
                                key={p}
                                onClick={() => setPage(p)}
                                className={`w-9 h-9 text-sm font-medium rounded-lg transition-colors ${
                                    p === page
                                        ? 'bg-indigo-600 text-white'
                                        : 'text-gray-600 bg-white border border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                {p}
                            </button>
                        ))}
                        <button
                            onClick={() => setPage(page + 1)}
                            disabled={page === totalPages}
                            className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Delete confirmation modal */}
            {confirmDeleteId && (() => {
                const product = products.find(p => p._id === confirmDeleteId)
                if (!product) return null
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div
                            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
                            onClick={() => setConfirmDeleteId(null)}
                        />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                            <div className="px-6 pt-6 pb-4">
                                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                                    <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 text-center mt-4">
                                    Remove this product?
                                </h3>
                                <p className="text-sm text-gray-500 text-center mt-2 leading-relaxed">
                                    <span className="font-medium text-gray-700">{product.name}</span> and all its
                                    {' '}{product.tiers.length} tier{product.tiers.length !== 1 ? 's' : ''}
                                    {product.features.length > 0 && <> and {product.features.length} feature{product.features.length !== 1 ? 's' : ''}</>}
                                    {' '}will be permanently deleted. Any quotes referencing this product won't be affected.
                                </p>
                            </div>
                            <div className="px-6 py-4 bg-gray-50 flex gap-3">
                                <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Keep product
                                </button>
                                <button
                                    onClick={() => handleDelete(product._id)}
                                    disabled={deleting === product._id}
                                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                                >
                                    {deleting === product._id ? 'Deleting...' : 'Yes, delete permanently'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
