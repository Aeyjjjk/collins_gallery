import { sb } from './supabase'

const KEY = 'ecu_device_id'
const counted = new Set<string>() // avoids repeat calls in one page session

const uuid = () =>
  crypto.randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 3) | 8).toString(16)
  })

// A random ID kept in this browser. If storage is blocked we skip counting rather than double-count.
function deviceId(): string | null {
  try {
    let id = localStorage.getItem(KEY)
    if (!id) { id = uuid(); localStorage.setItem(KEY, id) }
    return id
  } catch { return null }
}

export async function recordView(projectId: string): Promise<number | null> {
  if (!sb || counted.has(projectId)) return null
  const dev = deviceId()
  if (!dev) return null
  counted.add(projectId)
  const { data, error } = await sb.rpc('record_view', { p_project: projectId, p_device: dev })
  if (error) { counted.delete(projectId); return null }
  return typeof data === 'number' ? data : null
}

export const fmtViews = (n: number) =>
  `${new Intl.NumberFormat('en', { notation: 'compact' }).format(n)} ${n === 1 ? 'view' : 'views'}`