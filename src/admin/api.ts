import { useCallback, useEffect, useState } from 'react'
import { sb, BUCKET } from '../lib/supabase'
import { invalidate } from '../lib/data'
import { site } from '../config/site'
import { em } from '../lib/util'
import type { Category, Project } from '../types'

export const ok = () => { if (!sb) throw new Error('Backend is not configured. See README.'); return sb }
export function must<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

const MB = 1024 * 1024
const IMG = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const VID = ['video/mp4', 'video/webm']
export function validate(file: File): 'image' | 'video' {
  if (IMG.includes(file.type)) {
    if (file.size > site.limits.imageMB * MB) throw new Error(`${file.name}: images must be under ${site.limits.imageMB} MB.`)
    return 'image'
  }
  if (VID.includes(file.type)) {
    if (file.size > site.limits.videoMB * MB) throw new Error(`${file.name}: videos must be under ${site.limits.videoMB} MB.`)
    return 'video'
  }
  throw new Error(`${file.name}: use JPG, PNG, WebP, AVIF, MP4 or WebM.`)
}

// Real upload progress via XHR against the Storage REST endpoint, using the signed-in user's token.
export async function uploadWithProgress(path: string, file: Blob, onProgress?: (n: number) => void) {
  const s = ok()
  const token = (await s.auth.getSession()).data.session?.access_token
  if (!token) throw new Error('Your session expired. Sign in again.')
  await new Promise<void>((res, rej) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_ANON_KEY)
    const fd = new FormData()
    fd.append('cacheControl', '31536000')
    fd.append('', file)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
    xhr.onload = () => {
      if (xhr.status < 300) return res()
      let m = `Upload failed (${xhr.status}).`
      try { m = JSON.parse(xhr.responseText).message || m } catch { /* keep default */ }
      rej(new Error(m))
    }
    xhr.onerror = () => rej(new Error('Network error during upload.'))
    xhr.send(fd)
  })
}

const MARK_FONT = 'Primus, Montserrat, "Avenir Next", "Segoe UI", system-ui, sans-serif'
// Draws the centred watermark onto a canvas (no-op when disabled).
export function mark(cv: HTMLCanvasElement) {
  const w = site.watermark
  if (!w.enabled) return
  const ctx = cv.getContext('2d')!
  const label = (w.text || site.name).toUpperCase()
  ctx.save()
  ctx.font = `700 100px ${MARK_FONT}`
  const size = Math.min((100 * cv.width * w.width) / ctx.measureText(label).width, cv.height * 0.2)
  ctx.font = `700 ${size}px ${MARK_FONT}`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = size * 0.15
  ctx.fillStyle = `rgba(255,255,255,${w.opacity})`
  ctx.fillText(label, cv.width / 2, cv.height / 2)
  ctx.restore()
}

// Full-size watermarked copy (long side capped at 4096px).
export async function imageMarked(file: File, maxSide = 4096) {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const cv = document.createElement('canvas')
  cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k)
  cv.getContext('2d')!.drawImage(bmp, 0, 0, cv.width, cv.height)
  bmp.close()
  mark(cv)
  const want = file.type === 'image/png' || file.type === 'image/jpeg' ? file.type : 'image/webp'
  const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, want, 0.92))
  if (!blob) throw new Error('Could not process the image.')
  return { blob, ext: blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/png' ? 'png' : 'webp' }
}

export async function imageThumb(file: Blob, max = 720, doMark = true) {
  const bmp = await createImageBitmap(file)
  const ar = bmp.width / bmp.height
  const k = Math.min(1, max / bmp.width)
  const cv = document.createElement('canvas')
  cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k)
  cv.getContext('2d')!.drawImage(bmp, 0, 0, cv.width, cv.height)
  bmp.close()
  if (doMark) mark(cv)
  const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/webp', 0.8))
  if (!blob) throw new Error('Could not create thumbnail.')
  return { blob, ar }
}

export function videoFrame(file: File, max = 720) {
  return new Promise<{ blob: Blob; ar: number }>((res, rej) => {
    const v = document.createElement('video'), u = URL.createObjectURL(file)
    const fail = (m: string) => { clearTimeout(t); URL.revokeObjectURL(u); rej(new Error(m)) }
    const t = setTimeout(() => fail('timeout'), 10000)
    v.muted = true; v.preload = 'metadata'; v.playsInline = true; v.src = u
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 2) }
    v.onseeked = () => {
      const k = Math.min(1, max / v.videoWidth)
      const cv = document.createElement('canvas')
      cv.width = Math.round(v.videoWidth * k); cv.height = Math.round(v.videoHeight * k)
      cv.getContext('2d')!.drawImage(v, 0, 0, cv.width, cv.height)
      const ar = v.videoWidth / v.videoHeight
      mark(cv)
      cv.toBlob((b) => { clearTimeout(t); URL.revokeObjectURL(u); b ? res({ blob: b, ar }) : rej(new Error('thumb')) }, 'image/webp', 0.8)
    }
    v.onerror = () => fail('unreadable video')
  })
}

export async function removeFiles(paths: (string | null | undefined)[]) {
  const p = [...new Set(paths.filter((x): x is string => !!x && !/^(https?:|data:|\/)/.test(x)))]
  if (!p.length) return
  const { error } = await ok().storage.from(BUCKET).remove(p)
  if (error) throw new Error(error.message)
}

// Uploads the file plus a generated thumbnail. Cleans up after itself on failure.
export async function storeMedia(cat: string, file: File, onProgress?: (n: number) => void) {
  const kind = validate(file)
  const id = crypto.randomUUID()
  let body: File = file
  let ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (kind === 'image' && site.watermark.enabled) {
    try {
      const m = await imageMarked(file)
      ext = m.ext
      body = new File([m.blob], `media.${ext}`, { type: m.blob.type })
    } catch {
      throw new Error(`${file.name}: this browser can't watermark this image. Try a JPG, PNG or WebP.`)
    }
  }
  const src = `${cat}/${id}/media.${ext}`
  const uploaded: string[] = []
  try {
    await uploadWithProgress(src, body, onProgress)
    uploaded.push(src)
    let thumb: string | null = null, ar: number | null = null
    try {
      const t = kind === 'image' ? await imageThumb(body, 720, body === file) : await videoFrame(file)
      const tp = `${cat}/${id}/thumb.webp`
      await uploadWithProgress(tp, new File([t.blob], 'thumb.webp', { type: 'image/webp' }))
      thumb = tp; uploaded.push(tp); ar = t.ar
    } catch { /* thumbnail is optional; images fall back to the original */ }
    return { kind, src_path: src, thumb_path: thumb || (kind === 'image' ? src : null), aspect_ratio: ar, uploaded }
  } catch (e) {
    await removeFiles(uploaded).catch(() => {})
    throw new Error(em(e))
  }
}

export async function storeThumb(folder: string, file: File, max = 720) {
  if (validate(file) !== 'image') throw new Error('Choose an image file.')
  const t = await imageThumb(file, max)
  const path = `${folder}/${crypto.randomUUID()}/thumb.webp`
  await uploadWithProgress(path, new File([t.blob], 'thumb.webp', { type: 'image/webp' }))
  return { path, ar: t.ar }
}

export function useAdminData() {
  const [cats, setCats] = useState<Category[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [err, setErr] = useState('')
  const reload = useCallback(async () => {
    try {
      const s = ok()
      const [c, p] = await Promise.all([
        s.from('categories').select('*').order('sort_order'),
        s.from('projects').select('*').order('sort_order'),
      ])
      setCats(must(c) as Category[]); setProjects(must(p) as Project[]); setErr(''); invalidate()
    } catch (e) { setErr(em(e)) }
  }, [])
  useEffect(() => { reload() }, [reload])
  return { cats, projects, err, reload }
}
export type D = ReturnType<typeof useAdminData>
export type Act = (fn: () => Promise<unknown>, okMsg?: string) => Promise<void>