export interface LocationRecord {
  street?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  location_id?: number
  continent?: string | null
}

export function formatLocationLabel(record?: LocationRecord | null): string | null {
  if (!record) return null
  const parts = [record.street, record.city, record.state, record.country].filter(Boolean)
  return parts.join(', ') || null
}
