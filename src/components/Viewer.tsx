import { ChevronLeft, ChevronRight, ExternalLink, Eye, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { mediaUrl } from '../lib/supabase'
import { safeUrl } from '../lib/util'
import { fmtViews, recordView } from '../lib/views'
import type { Project } from '../types'
import { isLive } from '../types'

const LINK_LABEL: Record<string, string> = { website: 'Visit website', application: 'Open app', prototype: 'View prototype' }

export default function Viewer({ items, index, onIndex, onClose, counts, onCount }: {
  items: Project[]; index: number; onIndex: (i: number) => void; onClose: () => void
  counts?: Record<string, number>; onCount?: (id: string, n: number) => void // onCount present = public site, so views are recorded
}) {
  const p = items[index]
  const root = useRef<HTMLDivElement>(null)
  const touchX = useRef<number | null>(null)
  const [embed, setEmbed] = useState(false)
  const [failed, setFailed] = useState(false)
  const many = items.length > 1
  const go = (d: number) => onIndex((index + d + items.length) % items.length)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    root.current?.focus()
    return () => { document.body.style.overflow = ''; opener?.focus?.() }
  }, [])
  useEffect(() => { setEmbed(false); setFailed(false) }, [index])
  useEffect(() => {
    if (!onCount) return
    recordView(p.id).then((n) => { if (n !== null) onCount(p.id, n) })
  }, [p.id])
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (many && e.key === 'ArrowLeft') go(-1)
      else if (many && e.key === 'ArrowRight') go(1)
      else if (e.key === 'Tab' && root.current) {
        const f = Array.from(root.current.querySelectorAll<HTMLElement>('button,a[href],video[controls],iframe')).filter((x) => !x.hasAttribute('disabled'))
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const src = mediaUrl(p.src_path), thumb = mediaUrl(p.thumb_path || p.src_path)
  const url = safeUrl(p.project_url), source = safeUrl(p.source_url)
  const live = isLive(p.media_type)

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={p.title} tabIndex={-1} ref={root}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={(e) => {
        if (touchX.current === null || !many) return
        const dx = e.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (Math.abs(dx) > 60) go(dx > 0 ? -1 : 1)
      }}>
      <div className="v-top">
        <span className="muted" aria-live="polite">{index + 1} / {items.length}</span>
        <button className="icon" aria-label="Close viewer" onClick={onClose}><X size={22} /></button>
      </div>
      <div className="v-stage">
        {many && <button className="v-arrow l" aria-label="Previous" onClick={() => go(-1)}><ChevronLeft size={26} /></button>}
        {p.media_type === 'image' && <img className="v-media" src={src || thumb} alt={p.title} />}
        {p.media_type === 'video' && (src && !failed
          ? <video key={p.id} className="v-media" controls playsInline preload="metadata" poster={thumb} src={src}
              controlsList="nodownload noremoteplayback" disablePictureInPicture disableRemotePlayback onError={() => setFailed(true)} />
          : <div className="v-fallback"><img src={thumb} alt="" /><p>This video can't be played right now.</p></div>)}
        {live && (embed && url
          ? (
            <div className="v-browser">
              <i className="bar-dots" aria-hidden="true" />
              <iframe src={url} title={p.title} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
            </div>
          )
          : <img className="v-media" src={thumb} alt={p.title} />)}
        {many && <button className="v-arrow r" aria-label="Next" onClick={() => go(1)}><ChevronRight size={26} /></button>}
      </div>
      <div className="v-info">
        <div>
          <h3>{p.title}</h3>
          <p className="muted small views"><Eye size={14} aria-hidden="true" /> {fmtViews(counts?.[p.id] ?? p.view_count ?? 0)}</p>
          {p.description && <p className="muted">{p.description}</p>}
          {p.tags.length > 0 && <ul className="skills sm">{p.tags.map((t) => <li key={t}>{t}</li>)}</ul>}
        </div>
        <div className="v-actions">
          {live && !url && <span className="muted">Preview only. No live version linked.</span>}
          {live && url && <a className="btn primary" href={url} target="_blank" rel="noopener noreferrer">{LINK_LABEL[p.media_type]} <ExternalLink size={16} aria-hidden="true" /></a>}
          {live && url && <button className="btn" onClick={() => setEmbed((v) => !v)}>{embed ? 'Show screenshot' : 'Live preview'}</button>}
          {source && <a className="btn" href={source} target="_blank" rel="noopener noreferrer">Source code</a>}
        </div>
        {embed && <p className="muted small">If the preview stays blank, the site blocks embedding. Use the visit button instead.</p>}
      </div>
    </div>
  )
}