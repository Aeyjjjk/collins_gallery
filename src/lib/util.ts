export const safeUrl = (u?: string | null) => {
  if (!u) return ''
  try { const x = new URL(u.trim()); return x.protocol === 'http:' || x.protocol === 'https:' ? x.href : '' } catch { return '' }
}
export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
export const em = (e: unknown) => (e as { message?: string })?.message || 'Something went wrong'
