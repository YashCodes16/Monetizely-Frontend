import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { API_URL } from '@/lib/api'

interface QuoteSummary {
    _id: string
    slug: string
    quoteName: string
    customerName: string
    productSnapshot: {
        productName: string
        tierName: string
    }
    seats: number
    termLength: string
    total: number
    createdAt: string
}

const QUOTES_PER_PAGE = 10

const TERM_LABELS: Record<string, string> = {
    monthly: 'Monthly',
    annual: 'Annual',
    two_year: '2-Year',
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function QuotesPage() {
    const [quotes, setQuotes] = useState<QuoteSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)
    const [confirmDeleteSlug, setConfirmDeleteSlug] = useState<string | null>(null)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [error, setError] = useState('')

    function fetchQuotes(p: number) {
        setLoading(true)
        setError('')
        fetch(`${API_URL}/quotes?page=${p}&limit=${QUOTES_PER_PAGE}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to load quotes')
                return res.json()
            })
            .then(data => {
                setQuotes(data.quotes)
                setTotalPages(data.totalPages)
                setTotal(data.total)
                setLoading(false)
            })
            .catch(err => {
                setError(err instanceof Error ? err.message : 'Failed to load quotes')
                setLoading(false)
            })
    }

    useEffect(() => {
        fetchQuotes(page)
    }, [page])

    async function handleDelete(slug: string) {
        setDeleting(slug)
        setError('')
        try {
            const res = await fetch(`${API_URL}/quotes/${slug}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to delete quote')
            if (quotes.length === 1 && page > 1) {
                setPage(page - 1)
            } else {
                fetchQuotes(page)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete quote')
        } finally {
            setDeleting(null)
            setConfirmDeleteSlug(null)
        }
    }

    if (loading) {
        return <div className="text-center py-10 text-gray-500">Loading quotes...</div>
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
                    <p className="text-sm text-gray-500 mt-1">{total} quote{total !== 1 ? 's' : ''}</p>
                </div>
                <Link
                    to="/quotes/new"
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm inline-flex items-center gap-1.5"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    New Quote
                </Link>
            </div>

            {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-6">
                    {error}
                </div>
            )}

            {quotes.length === 0 && page === 1 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-gray-200 shadow-sm">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <p className="text-sm font-medium text-gray-500">No quotes yet</p>
                    <p className="text-xs text-gray-400 mt-1 mb-5">Build your first quote to get started.</p>
                    <Link
                        to="/quotes/new"
                        className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        Build a Quote
                    </Link>
                </div>
            ) : (
                <div className="space-y-3">
                    {quotes.map(quote => (
                        <div
                            key={quote._id}
                            className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group"
                        >
                            <div className="flex items-center px-6 py-5">
                                {/* Icon */}
                                <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                    </svg>
                                </div>

                                {/* Details */}
                                <Link to={`/quotes/${quote.slug}`} className="ml-4 flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">{quote.quoteName}</h2>
                                        <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(quote.createdAt)}</span>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-0.5">{quote.customerName}</p>
                                    <div className="flex items-center gap-1.5 mt-2">
                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                                            <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                            </svg>
                                            {quote.productSnapshot.productName}
                                        </span>
                                        <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">{quote.productSnapshot.tierName}</span>
                                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md">
                                            <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                                            </svg>
                                            {quote.seats} seat{quote.seats !== 1 ? 's' : ''}
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md">
                                            <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                            </svg>
                                            {TERM_LABELS[quote.termLength] || quote.termLength}
                                        </span>
                                    </div>
                                </Link>

                                {/* Total */}
                                <div className="ml-6 text-right flex-shrink-0">
                                    <div className="text-lg font-bold text-gray-900 font-mono">${quote.total.toLocaleString()}</div>
                                </div>

                                {/* Actions */}
                                <div className="ml-4 flex items-center gap-1 flex-shrink-0">
                                    <Link
                                        to={`/quotes/${quote.slug}`}
                                        className="w-8 h-8 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 inline-flex items-center justify-center transition-colors"
                                        title="View quote"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </Link>
                                    <button
                                        onClick={() => setConfirmDeleteSlug(quote.slug)}
                                        className="w-8 h-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 inline-flex items-center justify-center transition-colors"
                                        title="Delete quote"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                        Showing {(page - 1) * QUOTES_PER_PAGE + 1}&ndash;{Math.min(page * QUOTES_PER_PAGE, total)} of {total}
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
            {confirmDeleteSlug && (() => {
                const quote = quotes.find(q => q.slug === confirmDeleteSlug)
                if (!quote) return null
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div
                            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
                            onClick={() => setConfirmDeleteSlug(null)}
                        />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                            <div className="px-6 pt-6 pb-4">
                                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                                    <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 text-center mt-4">
                                    Delete this quote?
                                </h3>
                                <p className="text-sm text-gray-500 text-center mt-2 leading-relaxed">
                                    <span className="font-medium text-gray-700">{quote.quoteName}</span> for {quote.customerName} will be permanently deleted.
                                </p>
                            </div>
                            <div className="px-6 py-4 bg-gray-50 flex gap-3">
                                <button
                                    onClick={() => setConfirmDeleteSlug(null)}
                                    className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Keep quote
                                </button>
                                <button
                                    onClick={() => handleDelete(quote.slug)}
                                    disabled={deleting === quote.slug}
                                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                                >
                                    {deleting === quote.slug ? 'Deleting...' : 'Yes, delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
