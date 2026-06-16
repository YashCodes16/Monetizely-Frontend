export const API_URL = import.meta.env.VITE_API_URL 

export function resolveBasePrice(basePrice: { value: number; frequency: string }): number {
    return basePrice.value
}
