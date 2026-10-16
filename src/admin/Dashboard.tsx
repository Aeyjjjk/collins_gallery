import { ArrowDown, ArrowUp, Eye, Menu, Pencil, RefreshCw, Star, Trash2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Viewer from '../components/Viewer'
import { site } from '../config/site'
import { mediaUrl, sb } from '../lib/supabase'
import { em, safeUrl, slugify } from '../lib/util'
import { fmtViews } from '../lib/views'
import type { MediaType, Project } from '../types'
import { isLive } from '../types'
import { Act, D, must, ok, removeFiles, storeMedia, storeThumb, useAdminData, validate } from './api'

const TABS = [['overview', 'Overview'], ['media', 'All Media'], ['upload', 'Upload Media'], ['categories', 'Categories'], ['featured', 'Featured Work'], ['settings', 'Settings']] as const
type Tab = typeof TABS[number][0]

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => { window.removeEventListener('keydown', h); opener?.focus?.() }
  }, [])
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="row"><h2>{title}</h2><button className="icon" aria-label="Close" onClick={onClose}><X size={18} /></button></div>
        {children}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const nav = useNavigate()
  const [state, setState] = useState<'loading' | 'ok' | 'denied' | 'nobackend'>('loading')
  const [tab, setTab] = useState<Tab>('overview')
  const [menu, setMenu] = useState(false)
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; m: string } | null>(null)

  useEffect(() => {
    document.title = 'Admin'
    const meta = document.createElement('meta'); meta.name = 'robots'; meta.content = 'noindex'; document.head.append(meta)
    if (!sb) { setState('nobackend'); return () => meta.remove() }
    let alive = true
    ;(async () => {
      const u = (await sb.auth.getSession()).data.session?.user
      if (!u) { nav('/admin/login', { replace: true }); return }
      const r = await sb.from('admins').select('user_id').eq('user_id', u.id).maybeSingle()
      if (alive) setState(r.data ? 'ok' : 'denied')
    })()
    const { data } = sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') nav('/admin/login', { replace: true }) })
    return () => { alive = false; data.subscription.unsubscribe(); meta.remove() }
  }, [nav])

  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 4500); return () => clearTimeout(t) } }, [msg])
  const signOut = async () => { await sb?.auth.signOut(); nav('/admin/login', { replace: true }) }

  if (state === 'loading') return <main className="auth"><p className="muted">Checking access…</p></main>
  if (state === 'nobackend') return <main className="auth"><p className="err">Backend is not configured. Add your Supabase keys to .env (see README).</p></main>
  if (state === 'denied') return (
    <main className="auth"><div className="panel-box">
      <h1>Not authorized</h1><p className="muted">This account is not an administrator.</p>
      <button className="btn" onClick={signOut}>Sign out</button>
    </div></main>
  )
  return <Shell tab={tab} setTab={setTab} menu={menu} setMenu={setMenu} msg={msg} setMsg={setMsg} signOut={signOut} />
}

function Shell({ tab, setTab, menu, setMenu, msg, setMsg, signOut }: {
  tab: Tab; setTab: (t: Tab) => void; menu: boolean; setMenu: (b: boolean) => void
  msg: { t: 'ok' | 'err'; m: string } | null; setMsg: (m: { t: 'ok' | 'err'; m: string } | null) => void; signOut: () => void
}) {
  const d = useAdminData()
  const act: Act = async (fn, okMsg = 'Saved') => {
    try { await fn(); await d.reload(); setMsg({ t: 'ok', m: okMsg }) } catch (e) { setMsg({ t: 'err', m: em(e) }) }
  }
  return (
    <div className="adm">
      <div className="adm-bar"><button className="icon" aria-label="Open menu" onClick={() => setMenu(true)}><Menu size={20} /></button><b>Admin</b></div>
      <aside className={'adm-side' + (menu ? ' open' : '')} aria-label="Admin navigation">
        <b style={{ padding: '4px 12px 12px' }}>Portfolio admin</b>
        {TABS.map(([k, l]) => (
          <button key={k} className="tab" aria-current={tab === k ? 'page' : undefined} onClick={() => { setTab(k); setMenu(false) }}>{l}</button>
        ))}
        <span style={{ flex: 1 }} />
        <a className="tab muted" style={{ padding: '10px 12px' }} href="/" target="_blank" rel="noopener noreferrer">View site</a>
        <button className="tab" onClick={signOut}>Sign out</button>
      </aside>
      <main className="adm-main">
        {d.err && <p className="err" role="alert">{d.err}</p>}
        {tab === 'overview' && <Overview d={d} />}
        {tab === 'media' && <Media d={d} act={act} />}
        {tab === 'upload' && <Upload d={d} act={act} />}
        {tab === 'categories' && <Categories d={d} act={act} />}
        {tab === 'featured' && <Featured d={d} act={act} />}
        {tab === 'settings' && <Settings act={act} signOut={signOut} />}
      </main>
      {msg && <div className="toast" role="status"><span className={msg.t === 'ok' ? 'ok' : 'err'}>{msg.m}</span></div>}
    </div>
  )
}

function Overview({ d }: { d: D }) {
  const n = (f: (p: Project) => boolean) => d.projects.filter(f).length
  const stats: [string, number][] = [['Projects', d.projects.length], ['Images', n((p) => p.media_type === 'image')], ['Videos', n((p) => p.media_type === 'video')],
    ['Live projects', n((p) => isLive(p.media_type))], ['Categories', d.cats.length], ['Total views', d.projects.reduce((a, p) => a + (p.view_count || 0), 0)], ['Featured', n((p) => p.featured)], ['Drafts', n((p) => !p.published)]]
  return <><h1>Overview</h1><div className="stats">{stats.map(([l, v]) => <div className="stat" key={l}><b>{v}</b>{l}</div>)}</div></>
}

// ---------- reorder helper: renumber siblings then swap ----------
async function reorder<T extends { sort_order: number }>(list: T[], i: number, dir: number, table: 'projects' | 'categories', key: (x: T) => string) {
  const j = i + dir
  if (j < 0 || j >= list.length) return
  const l = [...list]; [l[i], l[j]] = [l[j], l[i]]
  const col = table === 'projects' ? 'id' : 'slug'
  for (let k = 0; k < l.length; k++) if (l[k].sort_order !== k) must(await ok().from(table).update({ sort_order: k }).eq(col, key(l[k])))
}

// ---------- All media ----------
function Media({ d, act }: { d: D; act: Act }) {
  const [q, setQ] = useState(''), [cat, setCat] = useState(''), [type, setType] = useState(''), [lim, setLim] = useState(30)
  const [edit, setEdit] = useState<{ p: Project; mode: 'edit' | 'replace' } | null>(null)
  const [view, setView] = useState<Project | null>(null), [del, setDel] = useState<Project | null>(null)
  const list = useMemo(() => d.projects.filter((p) => (!cat || p.category_id === cat) && (!type || p.media_type === type) && (!q || p.title.toLowerCase().includes(q.toLowerCase()))), [d.projects, q, cat, type])
  const sib = (p: Project) => d.projects.filter((x) => x.category_id === p.category_id)
  const label = (s: string) => d.cats.find((c) => c.slug === s)?.label || s

  return (
    <>
      <h1>All Media</h1>
      <div className="cols">
        <input type="search" placeholder="Search by title" aria-label="Search by title" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{d.cats.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}</select>
        <select aria-label="Media type" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{['image', 'video', 'website', 'application', 'prototype'].map((t) => <option key={t}>{t}</option>)}</select>
      </div>
      {!cat && <p className="muted small" style={{ marginTop: 8 }}>Choose a category to enable reordering.</p>}
      {list.length === 0 && <p className="empty" style={{ marginTop: 14 }}>No projects found. Upload some in Upload Media.</p>}
      <div className="agrid">
        {list.slice(0, lim).map((p, i) => (
          <article className="acard" key={p.id}>
            <img className="th" loading="lazy" decoding="async" alt="" src={mediaUrl(p.thumb_path || p.src_path)} />
            <div className="bd"><b>{p.title}</b>
              <span><span className="badge">{p.media_type}</span>{!p.published && <span className="badge">draft</span>}{p.featured && <span className="badge g">featured</span>}</span>
              <small className="muted">{label(p.category_id)} · {fmtViews(p.view_count || 0)}</small></div>
            <div className="acts">
              <button className="icon" aria-label={`View ${p.title}`} title="View" onClick={() => setView(p)}><Eye size={18} /></button>
              <button className="icon" aria-label={`Edit ${p.title}`} title="Edit" onClick={() => setEdit({ p, mode: 'edit' })}><Pencil size={18} /></button>
              {!isLive(p.media_type) && <button className="icon" aria-label={`Replace file for ${p.title}`} title="Replace file" onClick={() => setEdit({ p, mode: 'replace' })}><RefreshCw size={18} /></button>}
              <button className="icon" aria-label={p.featured ? 'Remove from featured' : 'Mark featured'} title="Feature" onClick={() => act(async () => { must(await ok().from('projects').update({ featured: !p.featured }).eq('id', p.id)) })}><Star size={18} fill={p.featured ? 'currentColor' : 'none'} /></button>
              <button className="icon" disabled={!cat} aria-label="Move earlier" title="Move earlier" onClick={() => { const s = sib(p); act(() => reorder(s, s.findIndex((x) => x.id === p.id), -1, 'projects', (x) => x.id)) }}><ArrowUp size={18} /></button>
              <button className="icon" disabled={!cat} aria-label="Move later" title="Move later" onClick={() => { const s = sib(p); act(() => reorder(s, s.findIndex((x) => x.id === p.id), 1, 'projects', (x) => x.id)) }}><ArrowDown size={18} /></button>
              <button className="icon" aria-label={`Delete ${p.title}`} title="Delete" onClick={() => setDel(p)}><Trash2 size={18} /></button>
            </div>
          </article>
        ))}
      </div>
      {list.length > lim && <button className="btn" style={{ marginTop: 14 }} onClick={() => setLim((l) => l + 30)}>Show more</button>}
      {view && <Viewer items={[view]} index={0} onIndex={() => {}} onClose={() => setView(null)} />}
      {edit && <EditDialog key={edit.p.id + edit.mode} {...edit} d={d} act={act} onClose={() => setEdit(null)} />}
      {del && (
        <Modal title="Delete project?" onClose={() => setDel(null)}>
          <p>“{del.title}” will be removed from the public site, and its stored file{del.thumb_path && del.thumb_path !== del.src_path ? 's (media and thumbnail)' : ''} will be deleted permanently.</p>
          <div className="row"><button className="btn" onClick={() => setDel(null)}>Cancel</button>
            <button className="btn danger" onClick={() => { const p = del; setDel(null); act(async () => { must(await ok().from('projects').delete().eq('id', p.id)); await removeFiles([p.src_path, p.thumb_path]).catch(() => {}) }, 'Deleted') }}>Delete permanently</button></div>
        </Modal>
      )}
    </>
  )
}

function EditDialog({ p, mode, d, act, onClose }: { p: Project; mode: 'edit' | 'replace'; d: D; act: Act; onClose: () => void }) {
  const [f, setF] = useState({ title: p.title, cat: p.category_id, sub: p.subcategory || '', desc: p.description || '', tags: p.tags.join(', '), year: p.year ? String(p.year) : '', url: p.project_url || '', source: p.source_url || '', pub: p.published, feat: p.featured })
  const [file, setFile] = useState<File | null>(null), [thumb, setThumb] = useState<File | null>(null)
  const [prog, setProg] = useState(0), [busy, setBusy] = useState(false), [err, setErr] = useState('')
  const subs = d.cats.find((c) => c.slug === f.cat)?.subcategories || []
  const up = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }))

  const save = async () => {
    setBusy(true); setErr('')
    const fresh: string[] = []
    try {
      const patch: Record<string, unknown> = {}
      if (mode === 'edit') {
        if ((f.url && !safeUrl(f.url)) || (f.source && !safeUrl(f.source))) throw new Error('URLs must start with http:// or https://')
        Object.assign(patch, { title: f.title.trim() || p.title, category_id: f.cat, subcategory: f.sub || null, description: f.desc.trim() || null,
          tags: f.tags.split(',').map((x) => x.trim()).filter(Boolean), year: f.year ? Number(f.year) : null,
          project_url: f.url.trim() || null, source_url: f.source.trim() || null, published: f.pub, featured: f.feat })
        if (thumb) { const t = await storeThumb(f.cat, thumb); fresh.push(t.path); patch.thumb_path = t.path; if (isLive(p.media_type)) patch.aspect_ratio = t.ar }
      } else {
        if (!file) throw new Error('Choose a file first.')
        if (validate(file) !== p.media_type) throw new Error(`This project is a ${p.media_type}. Choose a ${p.media_type} file.`)
        const m = await storeMedia(p.category_id, file, setProg)
        fresh.push(...m.uploaded)
        Object.assign(patch, { src_path: m.src_path, thumb_path: m.thumb_path, aspect_ratio: m.aspect_ratio })
      }
      must(await ok().from('projects').update(patch).eq('id', p.id))
      // the old file stays live until the new one is saved; only now remove what was replaced
      const keep = [patch.src_path ?? p.src_path, patch.thumb_path ?? p.thumb_path]
      const old = [...('src_path' in patch ? [p.src_path] : []), ...('thumb_path' in patch ? [p.thumb_path] : [])]
      await removeFiles(old.filter((x) => !keep.includes(x))).catch(() => {})
      await act(async () => {}, mode === 'edit' ? 'Saved' : 'File replaced')
      onClose()
    } catch (e) { await removeFiles(fresh).catch(() => {}); setErr(em(e)) } finally { setBusy(false) }
  }

  return (
    <Modal title={mode === 'edit' ? 'Edit project' : 'Replace file'} onClose={onClose}>
      {mode === 'edit' ? (
        <>
          <label className="field">Title<input value={f.title} onChange={(e) => up('title', e.target.value)} /></label>
          <div className="cols">
            <label className="field">Category<select value={f.cat} onChange={(e) => { up('cat', e.target.value); up('sub', '') }}>{d.cats.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}</select></label>
            <label className="field">Subcategory<select value={f.sub} onChange={(e) => up('sub', e.target.value)}><option value="">None</option>{subs.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
          </div>
          <label className="field">Description<textarea rows={3} value={f.desc} onChange={(e) => up('desc', e.target.value)} /></label>
          <div className="cols">
            <label className="field">Tags (comma separated)<input value={f.tags} onChange={(e) => up('tags', e.target.value)} /></label>
            <label className="field">Year<input inputMode="numeric" value={f.year} onChange={(e) => up('year', e.target.value.replace(/\D/g, '').slice(0, 4))} /></label>
          </div>
          <label className="field">Project URL<input type="url" value={f.url} onChange={(e) => up('url', e.target.value)} placeholder="https://" /></label>
          <label className="field">Source code URL<input type="url" value={f.source} onChange={(e) => up('source', e.target.value)} placeholder="https://" /></label>
          <label className="field">New thumbnail (optional)<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => setThumb(e.target.files?.[0] || null)} /></label>
          <label className="row" style={{ justifyContent: 'flex-start' }}><input type="checkbox" checked={f.pub} onChange={(e) => up('pub', e.target.checked)} /> Published (uncheck for draft)</label>
          <label className="row" style={{ justifyContent: 'flex-start' }}><input type="checkbox" checked={f.feat} onChange={(e) => up('feat', e.target.checked)} /> Featured</label>
        </>
      ) : (
        <>
          <p className="muted">The current {p.media_type} stays online until the new file finishes uploading.</p>
          <label className="field">New {p.media_type} file<input type="file" accept={p.media_type === 'image' ? 'image/jpeg,image/png,image/webp,image/avif' : 'video/mp4,video/webm'} onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
          {busy && <div className="bar"><i style={{ width: `${prog * 100}%` }} /></div>}
        </>
      )}
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row"><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button></div>
    </Modal>
  )
}

// ---------- Upload ----------
type QI = { id: string; file: File; url: string; kind: 'image' | 'video'; title: string; status: 'ready' | 'uploading' | 'done' | 'failed'; p: number; err?: string }

function Upload({ d, act }: { d: D; act: Act }) {
  const [mode, setMode] = useState<'files' | 'link'>('files')
  return (
    <>
      <h1>Upload Media</h1>
      <div className="chips" role="group" aria-label="Upload type" style={{ marginBottom: 14 }}>
        <button className="chip" aria-pressed={mode === 'files'} onClick={() => setMode('files')}>Images and videos</button>
        <button className="chip" aria-pressed={mode === 'link'} onClick={() => setMode('link')}>Website, app or prototype</button>
      </div>
      {mode === 'files' ? <FileUpload d={d} act={act} /> : <LinkForm d={d} act={act} />}
    </>
  )
}

function FileUpload({ d, act }: { d: D; act: Act }) {
  const [q, setQ] = useState<QI[]>([]), [catSel, setCat] = useState(''), [sub, setSub] = useState('')
  const [feat, setFeat] = useState(false), [pub, setPub] = useState(true), [drag, setDrag] = useState(false)
  const [note, setNote] = useState(''), [busy, setBusy] = useState(false)
  const cat = catSel || d.cats[0]?.slug || ''
  const subs = d.cats.find((c) => c.slug === cat)?.subcategories || []
  const patch = (id: string, v: Partial<QI>) => setQ((x) => x.map((i) => (i.id === id ? { ...i, ...v } : i)))

  const add = (fl: FileList | null) => {
    if (!fl) return
    const out: QI[] = [], errs: string[] = []
    for (const file of Array.from(fl)) {
      try { out.push({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), kind: validate(file), title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), status: 'ready', p: 0 }) }
      catch (e) { errs.push(em(e)) }
    }
    setQ((x) => [...x, ...out]); setNote(errs.join(' '))
  }
  const start = async () => {
    if (!cat) { setNote('Create a category first.'); return }
    setBusy(true)
    const s = ok()
    let order = Math.max(-1, ...d.projects.filter((x) => x.category_id === cat).map((x) => x.sort_order)) + 1
    for (const it of q.filter((i) => i.status === 'ready' || i.status === 'failed')) {
      patch(it.id, { status: 'uploading', p: 0, err: undefined })
      let uploaded: string[] = []
      try {
        const m = await storeMedia(cat, it.file, (n) => patch(it.id, { p: n }))
        uploaded = m.uploaded
        must(await s.from('projects').insert({ title: it.title.trim() || 'Untitled', category_id: cat, subcategory: sub || null, media_type: m.kind, src_path: m.src_path, thumb_path: m.thumb_path, aspect_ratio: m.aspect_ratio, featured: feat, published: pub, sort_order: order++, year: new Date().getFullYear(), tags: [] }))
        patch(it.id, { status: 'done', p: 1 })
      } catch (e) { await removeFiles(uploaded).catch(() => {}); patch(it.id, { status: 'failed', err: em(e) }) }
    }
    setBusy(false)
    await act(async () => {}, 'Upload run finished. Check each item’s status.')
  }
  const pending = q.filter((i) => i.status === 'ready' || i.status === 'failed').length

  return (
    <>
      <div className="panel-box">
        <div className="cols">
          <label className="field">Category<select value={cat} onChange={(e) => { setCat(e.target.value); setSub('') }}>{d.cats.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}</select></label>
          <label className="field">Subcategory<select value={sub} onChange={(e) => setSub(e.target.value)}><option value="">None</option>{subs.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        </div>
        <label className="row" style={{ justifyContent: 'flex-start' }}><input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} /> Publish immediately (uncheck to save as draft)</label>
        <label className="row" style={{ justifyContent: 'flex-start' }}><input type="checkbox" checked={feat} onChange={(e) => setFeat(e.target.checked)} /> Mark as featured</label>
      </div>
      <label className={'drop' + (drag ? ' on' : '')} style={{ display: 'block' }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files) }}>
        Drop files here or choose from your device
        <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm" onChange={(e) => { add(e.target.files); e.target.value = '' }} style={{ marginTop: 12 }} />
        <small style={{ display: 'block', marginTop: 8 }}>JPG, PNG, WebP, AVIF up to {site.limits.imageMB} MB · MP4, WebM up to {site.limits.videoMB} MB</small>
      </label>
      {note && <p className="err" role="alert" style={{ marginTop: 8 }}>{note}</p>}
      <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
        {q.map((i) => (
          <div className="qi" key={i.id}>
            {i.kind === 'image' ? <img src={i.url} alt="" /> : <video src={i.url} muted preload="metadata" />}
            <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
              <input aria-label="Title" value={i.title} disabled={i.status === 'uploading' || i.status === 'done'} onChange={(e) => patch(i.id, { title: e.target.value })} />
              <div className="bar"><i style={{ width: `${i.p * 100}%` }} /></div>
              <div className="row"><small className={i.status === 'failed' ? 'err' : i.status === 'done' ? 'ok' : 'muted'}>{i.status === 'failed' ? `Failed: ${i.err}` : i.status === 'done' ? 'Completed' : i.status === 'uploading' ? `Uploading ${Math.round(i.p * 100)}%` : 'Ready'}</small>
                {(i.status === 'ready' || i.status === 'failed') && <button className="muted" onClick={() => { URL.revokeObjectURL(i.url); setQ((x) => x.filter((y) => y.id !== i.id)) }}>Remove</button>}</div>
            </div>
          </div>
        ))}
      </div>
      {q.length > 0 && (
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn primary" disabled={busy || !pending} onClick={start}>{busy ? 'Uploading…' : q.some((i) => i.status === 'failed') ? 'Retry failed and upload' : `Upload ${pending} file${pending === 1 ? '' : 's'}`}</button>
          <button className="btn" disabled={busy} onClick={() => setQ((x) => x.filter((i) => i.status !== 'done'))}>Clear completed</button>
        </div>
      )}
    </>
  )
}

function LinkForm({ d, act }: { d: D; act: Act }) {
  const [f, setF] = useState({ type: 'website' as MediaType, title: '', url: '', cat: '', sub: '', desc: '', pub: true })
  const [thumb, setThumb] = useState<File | null>(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const cat = f.cat || d.cats.find((c) => c.slug === 'images')?.slug || d.cats[0]?.slug || ''
  const subs = d.cats.find((c) => c.slug === cat)?.subcategories || []
  const sub = f.sub || subs.find((x) => x.id === 'websites')?.id || ''
  const submit = async () => {
    setBusy(true); setErr('')
    let path = ''
    try {
      if (!f.title.trim()) throw new Error('Add a title.')
      if (f.url && !safeUrl(f.url)) throw new Error('URL must start with http:// or https://')
      if (!cat) throw new Error('Create a category first.')
      let ar: number | null = null
      if (thumb) { const t = await storeThumb(cat, thumb, 1200); path = t.path; ar = t.ar }
      const order = Math.max(-1, ...d.projects.filter((x) => x.category_id === cat).map((x) => x.sort_order)) + 1
      must(await ok().from('projects').insert({ title: f.title.trim(), category_id: cat, subcategory: sub || null, media_type: f.type, thumb_path: path || null, aspect_ratio: ar, description: f.desc.trim() || null, project_url: f.url.trim() || null, published: f.pub, sort_order: order, year: new Date().getFullYear(), tags: [] }))
      setF({ ...f, title: '', url: '', desc: '' }); setThumb(null)
      await act(async () => {}, 'Project added')
    } catch (e) { if (path) await removeFiles([path]).catch(() => {}); setErr(em(e)) } finally { setBusy(false) }
  }
  return (
    <div className="panel-box">
      <div className="cols">
        <label className="field">Type<select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as MediaType })}><option value="website">Website</option><option value="application">App</option><option value="prototype">Prototype</option></select></label>
        <label className="field">Category<select value={cat} onChange={(e) => setF({ ...f, cat: e.target.value, sub: '' })}>{d.cats.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}</select></label>
        <label className="field">Subcategory<select value={sub} onChange={(e) => setF({ ...f, sub: e.target.value })}><option value="">None</option>{subs.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
      </div>
      <label className="field">Title<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <label className="field">Live URL (leave empty for a preview-only entry)<input type="url" placeholder="https://" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /></label>
      <label className="field">Short description (optional)<input value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} /></label>
      <label className="field">Screenshot<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => setThumb(e.target.files?.[0] || null)} /></label>
      <label className="row" style={{ justifyContent: 'flex-start' }}><input type="checkbox" checked={f.pub} onChange={(e) => setF({ ...f, pub: e.target.checked })} /> Publish immediately</label>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn primary" disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Add project'}</button>
    </div>
  )
}

// ---------- Categories ----------
function Categories({ d, act }: { d: D; act: Act }) {
  const [label, setLabel] = useState('')
  return (
    <>
      <h1>Categories</h1>
      <div className="panel-box">
        <div className="row"><input style={{ flex: 1, minWidth: 180 }} placeholder="New category name" aria-label="New category name" value={label} onChange={(e) => setLabel(e.target.value)} />
          <button className="btn primary" onClick={() => act(async () => {
            const slug = slugify(label); if (!slug) throw new Error('Enter a category name.')
            must(await ok().from('categories').insert({ slug, label: label.trim(), sort_order: Math.max(-1, ...d.cats.map((c) => c.sort_order)) + 1 })); setLabel('')
          }, 'Category added')}>Add category</button></div>
      </div>
      {d.cats.map((c, i) => <CatRow key={c.slug} c={c} i={i} d={d} act={act} />)}
    </>
  )
}

function CatRow({ c, i, d, act }: { c: D['cats'][number]; i: number; d: D; act: Act }) {
  const [label, setLabel] = useState(c.label), [desc, setDesc] = useState(c.description), [vis, setVis] = useState(c.visible)
  const [subs, setSubs] = useState(c.subcategories.map((s) => s.label).join(', '))
  const [del, setDel] = useState(false), [target, setTarget] = useState('')
  const count = d.projects.filter((p) => p.category_id === c.slug).length
  const others = d.cats.filter((x) => x.slug !== c.slug)

  const save = () => act(async () => {
    const next = subs.split(',').map((x) => x.trim()).filter(Boolean).map((l) => ({ id: slugify(l), label: l }))
    const ids = new Set(next.map((n) => n.id))
    const lost = c.subcategories.find((s) => !ids.has(s.id) && d.projects.some((p) => p.category_id === c.slug && p.subcategory === s.id))
    if (lost) throw new Error(`Subcategory “${lost.label}” still has projects. Move them first.`)
    must(await ok().from('categories').update({ label: label.trim() || c.label, description: desc, visible: vis, subcategories: next }).eq('slug', c.slug))
  })
  const preview = (file: File | undefined) => file && act(async () => {
    const t = await storeThumb(`_categories/${c.slug}`, file, 1200)
    try { must(await ok().from('categories').update({ preview_path: t.path }).eq('slug', c.slug)) } catch (e) { await removeFiles([t.path]).catch(() => {}); throw e }
    await removeFiles([c.preview_path]).catch(() => {})
  }, 'Preview updated')
  const remove = () => act(async () => {
    if (count > 0 && !target) throw new Error('Choose where to move its projects.')
    if (count > 0) must(await ok().from('projects').update({ category_id: target, subcategory: null }).eq('category_id', c.slug))
    must(await ok().from('categories').delete().eq('slug', c.slug))
    await removeFiles([c.preview_path]).catch(() => {})
    setDel(false)
  }, 'Category deleted')

  return (
    <div className="panel-box">
      <div className="row"><b>{c.label}</b><span className="muted small">{count} project{count === 1 ? '' : 's'} · /{c.slug}</span></div>
      <div className="cols">
        <label className="field">Name<input value={label} onChange={(e) => setLabel(e.target.value)} /></label>
        <label className="field">Description<input value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
      </div>
      <label className="field">Subcategories (comma separated)<input value={subs} onChange={(e) => setSubs(e.target.value)} /></label>
      <div className="row">
        <label className="field">Preview image<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => preview(e.target.files?.[0])} /></label>
        <label className="row"><input type="checkbox" checked={vis} onChange={(e) => setVis(e.target.checked)} /> Visible on site</label>
      </div>
      <div className="row">
        <span>
          <button className="icon" disabled={i === 0} aria-label={`Move ${c.label} up`} onClick={() => act(() => reorder(d.cats, i, -1, 'categories', (x) => x.slug))}><ArrowUp size={18} /></button>
          <button className="icon" disabled={i === d.cats.length - 1} aria-label={`Move ${c.label} down`} onClick={() => act(() => reorder(d.cats, i, 1, 'categories', (x) => x.slug))}><ArrowDown size={18} /></button>
        </span>
        <span><button className="btn danger" onClick={() => setDel(true)}>Delete</button> <button className="btn primary" onClick={save}>Save</button></span>
      </div>
      {del && (
        <Modal title={`Delete “${c.label}”?`} onClose={() => setDel(false)}>
          {count > 0 ? (
            <>
              <p>This category has {count} project{count === 1 ? '' : 's'}. They are not deleted. Move them to another category:</p>
              <select aria-label="Move projects to" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Choose a category</option>{others.map((x) => <option key={x.slug} value={x.slug}>{x.label}</option>)}</select>
            </>
          ) : <p>This category is empty. It will be removed.</p>}
          <p className="muted small">To hide a category without deleting it, uncheck “Visible on site” instead.</p>
          <div className="row"><button className="btn" onClick={() => setDel(false)}>Cancel</button><button className="btn danger" onClick={remove}>Delete category</button></div>
        </Modal>
      )}
    </div>
  )
}

// ---------- Featured ----------
function Featured({ d, act }: { d: D; act: Act }) {
  const [pick, setPick] = useState('')
  const feat = d.projects.filter((p) => p.featured), rest = d.projects.filter((p) => !p.featured)
  const set = (id: string, v: boolean) => act(async () => { must(await ok().from('projects').update({ featured: v }).eq('id', id)); setPick('') })
  return (
    <>
      <h1>Featured Work</h1>
      <p className="muted" style={{ marginBottom: 14 }}>Featured projects appear first in their category and are used as the category preview when no preview image is set.</p>
      <div className="row panel-box">
        <select style={{ flex: 1, minWidth: 180 }} aria-label="Add a featured project" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">Choose a project to feature</option>{rest.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
        <button className="btn primary" disabled={!pick} onClick={() => set(pick, true)}>Feature</button>
      </div>
      {feat.length === 0 && <p className="empty">Nothing featured yet.</p>}
      <div className="agrid">
        {feat.map((p) => (
          <article className="acard" key={p.id}>
            <img className="th" loading="lazy" alt="" src={mediaUrl(p.thumb_path || p.src_path)} />
            <div className="bd"><b>{p.title}</b><small className="muted">{d.cats.find((c) => c.slug === p.category_id)?.label}</small></div>
            <div className="acts"><button className="btn" onClick={() => set(p.id, false)}>Remove</button></div>
          </article>
        ))}
      </div>
      <p className="muted small" style={{ marginTop: 14 }}>Change order inside a category from All Media (choose the category, then use the arrows).</p>
    </>
  )
}

// ---------- Settings ----------
function Settings({ act, signOut }: { act: Act; signOut: () => void }) {
  const [pw, setPw] = useState('')
  const [email, setEmail] = useState('')
  useEffect(() => { sb?.auth.getUser().then(({ data }) => setEmail(data.user?.email || '')) }, [])
  return (
    <>
      <h1>Settings</h1>
      <div className="panel-box">
        <p>Signed in as <b>{email}</b></p>
        <label className="field">New password (at least 10 characters)<input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <button className="btn primary" disabled={pw.length < 10} onClick={() => act(async () => { const { error } = await ok().auth.updateUser({ password: pw }); if (error) throw new Error(error.message); setPw('') }, 'Password updated')}>Change password</button>
      </div>
      <div className="panel-box">
        <p className="muted">Upload limits: images {site.limits.imageMB} MB, videos {site.limits.videoMB} MB. The storage bucket also enforces 50 MB per file. Change both together if your Supabase plan allows more.</p>
        <button className="btn" onClick={signOut}>Sign out</button>
      </div>
    </>
  )
}