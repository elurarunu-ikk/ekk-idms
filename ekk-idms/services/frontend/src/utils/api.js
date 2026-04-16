const BASE = import.meta.env.VITE_API_BASE || ''

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('ekk_token')
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}
