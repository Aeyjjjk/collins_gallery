import { useEffect, useState } from 'react'
import { sb } from './supabase'
import type { Category, Project } from '../types'

type Catalog = { cats: Category[]; projects: Project[] }
let cache: Catalog | null = null
export const invalidate = () => { cache = null }

async function loadCatalog(): Promise<Catalog> {
  if (cache) return cache
  if (!sb) return (cache = { cats: [], projects: [] })
  const [c, p] = await Promise.all([
    sb.from('categories').select('*').eq('visible', true).order('sort_order'),
    sb.from('projects').select('*').eq('published', true).order('sort_order'),
  ])
  if (c.error || p.error) throw new Error((c.error || p.error)!.message)
  return (cache = { cats: c.data as Category[], projects: p.data as Project[] })
}

export function useCatalog() {
  const [s, set] = useState({ cats: cache?.cats ?? [], projects: cache?.projects ?? [], loading: !cache, error: '' })
  useEffect(() => {
    if (cache) return
    let on = true
    loadCatalog()
      .then((c) => on && set({ ...c, loading: false, error: '' }))
      .catch((e) => on && set((x) => ({ ...x, loading: false, error: e.message || 'Could not load work.' })))
    return () => { on = false }
  }, [])
  return s
}