import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const sb = url && key ? createClient(url, key) : null
export const BUCKET = 'portfolio'
// Storage paths become public URLs; absolute/data/local URLs pass through (demo content).
export const mediaUrl = (p?: string | null) =>
  !p ? '' : /^(https?:|data:|\/)/.test(p) || !sb ? p : sb.storage.from(BUCKET).getPublicUrl(p).data.publicUrl
