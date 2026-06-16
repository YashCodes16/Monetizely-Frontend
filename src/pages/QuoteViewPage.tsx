import { useParams } from 'react-router-dom'
import QuoteView from '@/components/QuoteView'

export default function QuoteViewPage() {
    const { slug } = useParams<{ slug: string }>()
    if (!slug) return null
    return <QuoteView slug={slug} />
}
