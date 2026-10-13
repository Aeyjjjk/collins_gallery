import { ArrowLeft, ArrowUpRight, Play, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { site } from '../config/site'
import { useCatalog } from '../lib/data'
import { mediaUrl } from '../lib/supabase'
import type { Project } from '../types'
import { isLive } from '../types'
import Viewer from './Viewer'

const GROUPS = [['all', 'All'], ['image', 'Images'], ['video', 'Videos'], ['live', 'Live projects']] as const
const inGroup = (p: Project, g: string) => g === 'all' || (g === 'live' ? isLive(p.media_type) : p.media_type === g)
const KIND: Record<string, string> = { image: 'Image', video: 'Video', website: 'Website', application: 'App', prototype: 'Prototype' }

function Card({ p, onOpen, eager }: { p: Project; onOpen: () => void; eager: boolean }) {
  const [nat, setNat] = useState<number | null>(null) // measured ratio when none is stored
  const ar = p.aspect_ratio || nat || (p.media_type === 'video' ? 16 / 9 : 1)
  const live = isLive(p.media_type)
  return (
    <button className="card" onClick={onOpen} aria-label={`Open ${p.title}`}>
      <span className={'frame' + (live ? ' browser' : '')}>
        {live && <i className="bar-dots" aria-hidden="true" />}
        <span className="shot" style={{ aspectRatio: String(ar) }}>
          <img src={mediaUrl(p.thumb_path || p.src_path)} alt="" width={800} height={Math.round(800 / ar)}
            loading={eager ? 'eager' : 'lazy'} decoding="async"
            onLoad={(e) => { const i = e.currentTarget; if (!p.aspect_ratio && i.naturalWidth) setNat(i.naturalWidth / i.naturalHeight) }}
            onError={(e) => { e.currentTarget.style.opacity = '0' }} />
          {p.media_type === 'video' && <span className="play" aria-hidden="true"><Play size={20} /></span>}
        </span>
      </span>
      <span className="cap"><b>{p.title}</b><small>{[p.year, KIND[p.media_type]].filter(Boolean).join(' · ')}</small></span>
    </button>
  )
}

export default function Explorer() {
  const { cats, projects, loading, error } = useCatalog()
  const [sp, setSp] = useSearchParams()
  const c = sp.get('c') || '', f = sp.get('f') || 'all', t = sp.get('t') || 'all', q = sp.get('q') || ''
  const [limit, setLimit] = useState(site.limits.pageSize)
  const [open, setOpen] = useState<number | null>(null)

  const set = (patch: Record<string, string>, push = true) => {
    const n = new URLSearchParams(sp)
    for (const [k, v] of Object.entries(patch)) v && v !== 'all' ? n.set(k, v) : n.delete(k)
    setSp(n, { replace: !push })
  }
  const pick = (slug: string) => {
    set({ c: slug, f: '', t: '' })
    requestAnimationFrame(() => document.getElementById('work')?.scrollIntoView())
  }
  useEffect(() => setLimit(site.limits.pageSize), [c, f, t, q])

  const cat = cats.find((x) => x.slug === c)
  const visible = useMemo(() => {
    const labels = Object.fromEntries(cats.map((x) => [x.slug, x.label]))
    const needle = q.trim().toLowerCase()
    return projects
      .filter((p) => labels[p.category_id] && (!c || p.category_id === c) && (f === 'all' || p.subcategory === f) && inGroup(p, t) &&
        (!needle || [p.title, p.description, labels[p.category_id], p.subcategory, ...p.tags].join(' ').toLowerCase().includes(needle)))
      .sort((a, b) => Number(b.featured) - Number(a.featured) || a.sort_order - b.sort_order)
  }, [cats, projects, c, f, t, q])
  const inCat = projects.filter((p) => !c || p.category_id === c)
  const groupsPresent = GROUPS.filter(([g]) => g === 'all' || inCat.some((p) => inGroup(p, g)))
  const gallery = !!(c || q)

  return (
    <section className="block explorer" id="work" aria-labelledby="work-h"
      onContextMenu={(e) => { if ((e.target as HTMLElement).closest('img,video,.card,.panel,.viewer')) e.preventDefault() }}
      onDragStart={(e) => e.preventDefault()}>
      <div className="ex-head">
        <h2 id="work-h">{cat ? cat.label : 'SELECT YOUR INTEREST'}</h2>
        <p className="muted">
          {site.available && <span className="dot" aria-hidden="true" />}
          {cat ? cat.description : site.tagline}
        </p>
      </div>

      {error && <p className="notice" role="alert">{error}</p>}
      {loading && <div className="panels skel" aria-hidden="true" />}

      {!loading && !gallery && (
        <>
          <label className="search wide"><Search size={18} aria-hidden="true" />
            <input type="search" value={q} onChange={(e) => set({ q: e.target.value }, false)} placeholder="Search all work" aria-label="Search all work" />
          </label>
          {cats.length === 0 ? <p className="empty">No work has been published yet.</p> : (
            <div className={'panels' + (cats.length <= 3 ? ' few' : '')}>
              {cats.map((x, i) => {
                const items = projects.filter((p) => p.category_id === x.slug)
                const pv = x.preview_path || (items.find((p) => p.featured) || items[0])?.thumb_path
                return (
                  <button key={x.slug} className="panel" onClick={() => pick(x.slug)} aria-label={`Open ${x.label}, ${items.length} projects`}>
                    {pv ? <img src={mediaUrl(pv)} alt="" loading={i < 2 ? 'eager' : 'lazy'} decoding="async" /> : <span className="panel-empty" />}
                    <span className="panel-meta"><strong>{x.label}</strong><small>{items.length} {items.length === 1 ? 'project' : 'projects'}</small></span>
                    <ArrowUpRight className="panel-arrow" size={22} aria-hidden="true" />
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {!loading && gallery && (
        <div className="workspace" key={c || 'all'}>
          <div className="toolbar">
            <button className="btn" onClick={() => setSp(new URLSearchParams())}><ArrowLeft size={18} aria-hidden="true" /> Overview</button>
            <nav className="chips scroll" aria-label="Categories">
              {cats.map((x) => (
                <button key={x.slug} className="chip" aria-pressed={x.slug === c} onClick={() => pick(x.slug)}>{x.label}</button>
              ))}
            </nav>
            <label className="search"><Search size={18} aria-hidden="true" />
              <input type="search" value={q} onChange={(e) => set({ q: e.target.value }, false)} placeholder="Search" aria-label="Search work" />
              {q && <button className="icon" aria-label="Clear search" onClick={() => set({ q: '' }, false)}><X size={16} /></button>}
            </label>
          </div>

          {(cat || groupsPresent.length > 2) && (
            <div className="subbar">
              {cat && cat.subcategories.length > 0 && (
                <div className="chips scroll" role="group" aria-label="Subcategory">
                  <button className="chip" aria-pressed={f === 'all'} onClick={() => set({ f: '' })}>All</button>
                  {cat.subcategories.map((s) => <button key={s.id} className="chip" aria-pressed={f === s.id} onClick={() => set({ f: s.id })}>{s.label}</button>)}
                </div>
              )}
              {groupsPresent.length > 2 && (
                <div className="chips scroll" role="group" aria-label="Media type">
                  {groupsPresent.map(([g, l]) => <button key={g} className="chip alt" aria-pressed={t === g} onClick={() => set({ t: g })}>{l}</button>)}
                </div>
              )}
            </div>
          )}

          {visible.length === 0 ? (
            <div className="empty">
              <p>Nothing matches{q ? ` “${q}”` : ''} here.</p>
              <button className="btn" onClick={() => set({ f: '', t: '', q: '' })}>Clear filters</button>
            </div>
          ) : (
            <>
              <ul className="masonry">
                {visible.slice(0, limit).map((p, i) => <li key={p.id}><Card p={p} eager={i < 4} onOpen={() => setOpen(i)} /></li>)}
              </ul>
              {visible.length > limit && <button className="btn more" onClick={() => setLimit((l) => l + site.limits.pageSize)}>Show more</button>}
            </>
          )}
        </div>
      )}
      {open !== null && visible[open] && <Viewer items={visible} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </section>
  )
}