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

const toBlob = (cv: HTMLCanvasElement, type: string, q?: number) =>
  new Promise<Blob | null>((r) => cv.toBlob(r, type, q))

// Decodes an image; falls back to an <img> element when createImageBitmap is unavailable or fails.
async function decode(file: Blob): Promise<{ src: CanvasImageSource; w: number; h: number; done: () => void }> {
  try {
    const b = await createImageBitmap(file)
    return { src: b, w: b.width, h: b.height, done: () => b.close() }
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('the image could not be decoded')); img.src = url })
      return { src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) }
    } catch (e) { URL.revokeObjectURL(url); throw e }
  }
}

export async function imageThumb(file: Blob, max = 720) {
  const d = await decode(file)
  try {
    const ar = d.w / d.h
    const k = Math.min(1, max / d.w)
    const cv = document.createElement('canvas')
    cv.width = Math.max(1, Math.round(d.w * k)); cv.height = Math.max(1, Math.round(d.h * k))
    cv.getContext('2d')!.drawImage(d.src, 0, 0, cv.width, cv.height)
    const blob = await toBlob(cv, 'image/webp', 0.8)
    if (!blob) throw new Error('Could not create thumbnail.')
    return { blob, ar }
  } finally { d.done() }
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
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
  const src = `${cat}/${id}/media.${ext}`
  const uploaded: string[] = []
  try {
    await uploadWithProgress(src, file, onProgress)
    uploaded.push(src)
    let thumb: string | null = null, ar: number | null = null
    try {
      const t = kind === 'image' ? await imageThumb(file) : await videoFrame(file)
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
