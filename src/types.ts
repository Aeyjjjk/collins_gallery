export type MediaType = 'image' | 'video' | 'website' | 'application' | 'prototype'
export interface Sub { id: string; label: string }
export interface Category {
  slug: string; label: string; description: string; preview_path: string | null
  sort_order: number; visible: boolean; subcategories: Sub[]
}
export interface Project {
  id: string; title: string; category_id: string; subcategory: string | null
  media_type: MediaType; src_path: string | null; thumb_path: string | null
  aspect_ratio: number | null; description: string | null; tags: string[]
  year: number | null; featured: boolean; published: boolean; sort_order: number
  project_url: string | null; source_url: string | null
}
export const isLive = (t: MediaType) => t === 'website' || t === 'application' || t === 'prototype'
