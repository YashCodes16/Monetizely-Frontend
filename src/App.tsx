import { Routes, Route, Link, Navigate } from 'react-router-dom'
import CatalogPage from './pages/CatalogPage'
import NewProductPage from './pages/NewProductPage'
import EditProductPage from './pages/EditProductPage'
import QuotesPage from './pages/QuotesPage'
import NewQuotePage from './pages/NewQuotePage'
import QuoteViewPage from './pages/QuoteViewPage'

export default function App() {
    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <nav className="bg-white border-b border-gray-200">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <Link to="/" className="text-xl font-bold text-indigo-600">
                            Monetizely
                        </Link>
                        <div className="flex gap-6">
                            <Link
                                to="/catalog"
                                className="text-gray-600 hover:text-gray-900 font-medium"
                            >
                                Catalog
                            </Link>
                            <Link
                                to="/quotes"
                                className="text-gray-600 hover:text-gray-900 font-medium"
                            >
                                Quotes
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>
            <main className="flex-1">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <Routes>
                        <Route path="/" element={<Navigate to="/catalog" replace />} />
                        <Route path="/catalog" element={<CatalogPage />} />
                        <Route path="/catalog/new" element={<NewProductPage />} />
                        <Route path="/catalog/:id" element={<EditProductPage />} />
                        <Route path="/quotes" element={<QuotesPage />} />
                        <Route path="/quotes/new" element={<NewQuotePage />} />
                        <Route path="/quotes/:slug" element={<QuoteViewPage />} />
                    </Routes>
                </div>
            </main>
        </div>
    )
}
