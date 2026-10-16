import { ArrowDown, Briefcase, Github, Instagram, Linkedin } from 'lucide-react'
import type { CSSProperties, ComponentType } from 'react'
import { useEffect, useState } from 'react'
import { site } from '../config/site'
import { safeUrl } from '../lib/util'

type Ico = ComponentType<{ size?: number | string }>
const svg = (d: string): Ico => ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={d} /></svg>
)
const WhatsApp = svg('M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z')

const ICONS: Record<string, [Ico, string]> = {
  whatsapp: [WhatsApp, 'WhatsApp'], instagram: [Instagram, 'Instagram'], portfolio: [Briefcase, 'Portfolio'], linkedin: [Linkedin, 'LinkedIn'], github: [Github, 'GitHub'],
}
const hrefFor = (k: string, v: string) => {
  if (k === 'whatsapp' && !/^https?:/i.test(v)) { const n = v.replace(/\D/g, ''); return n ? `https://wa.me/${n}` : '' }
  return safeUrl(v)
}

export function Socials() {
  const items = Object.keys(ICONS)
    .map((k) => ({ k, href: site.socials[k] ? hrefFor(k, site.socials[k]) : '' }))
    .filter((x) => x.href)
  if (!items.length) return null
  return (
    <ul className="socials" aria-label="Contact and social links">
      {items.map(({ k, href }) => {
        const [Icon, label] = ICONS[k]
        return (
          <li key={k}>
            <a href={href} aria-label={label} title={label} target="_blank" rel="noopener noreferrer"><Icon size={20} /></a>
          </li>
        )
      })}
    </ul>
  )
}

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    let raf = 0
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setScrolled(window.scrollY > 40)) }
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => { window.removeEventListener('scroll', on); cancelAnimationFrame(raf) }
  }, [])
  return (
    <header className={'site-header' + (scrolled ? ' scrolled' : '')}>
      <a href="#top" className="mark" aria-label="Top of page">Hello!!</a>
      <nav aria-label="Primary"><a href="#work">Works</a><a href="#about">About</a></nav>
    </header>
  )
}

export function Hero() {
  const vars = { '--pos-d': site.hero.posDesktop, '--pos-m': site.hero.posMobile } as CSSProperties
  return (
    <section className="hero" id="top" style={vars}>
      <picture>
        {site.hero.mobile && <source media="(max-width: 799px)" srcSet={site.hero.mobile} />}
        <img src={site.hero.desktop} alt={`Portrait of ${site.name}`} loading="eager" decoding="async"
          onError={(e) => { e.currentTarget.style.display = 'none' }} />
      </picture>
      <div className="hero-content">
        <Socials />
        <h1><span>{site.first}</span> <span>{site.rest}</span></h1>
        <p className="sub">{site.subtitle}</p>
      </div>
      <a className="cue" href="#work" aria-label="Explore my work: scroll down">
        <span>EXPLORE MY WORK</span><ArrowDown size={22} />
      </a>
    </section>
  )
}

export function About() {
  return (
    <section className="block" id="about" aria-labelledby="about-h">
      <h2 id="about-h">About</h2>
      <p className="lead">{site.about.text}</p>
      <ul className="skills">{site.about.skills.map((s) => <li key={s}>{s}</li>)}</ul>
    </section>
  )
}

export function Footer() {
  return <footer className="foot">© {new Date().getFullYear()} {site.name}</footer>
}