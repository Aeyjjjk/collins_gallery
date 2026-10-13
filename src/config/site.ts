// Everything personal lives here. Empty strings are hidden on the site.
export const site = {
  name: 'Echezonachi Collins UGWUJA',
  first: 'Echezonachi',
  rest: 'Collins Ugwuja',
  subtitle: 'Video Edits · Developer · Engineer',
  tagline: "A collection of things I've created.",
  available: true,
  hero: {
    desktop: '/images/robot.jpg', // put your photo in public/images/
    mobile: '/images/hero.jpg', // optional portrait crop, e.g. '/images/profile-hero-mobile.webp'
    posDesktop: 'center 50%',
    posMobile: 'center top',
  },
  // Only platforms with a value are shown, in this order.
  // whatsapp: number with country code, digits only (e.g. '2348012345678'), or a full https://wa.me/... link
  // x / instagram / linkedin: full profile URL (https://...)
  socials: { whatsapp: '2349064574106', instagram: 'https://www.instagram.com/collinsslides?vrfl=Y2h0OG1xYnQ1aGw1', portfolio: 'https://aboutcollins.vercel.app', linkedin: 'https://www.linkedin.com/in/echezonachi-u-568069293?utm_source=share_via&utm_content=profile&utm_medium=member_android', github: 'https://github.com/Aeyjjjk' } as Record<string, string>,
  about: {
    text: 'I work across digital design, embedded/IOT development, application development and technical projects.',
    skills: ['Graphic design', 'Video editing', 'Web development', 'AI Agents design', 'Mini apps', 'Embedded systems'],
  },

  watermark: { enabled: true, text: '', opacity: 0.35, width: 0.55 },
  limits: { imageMB: 15, videoMB: 50, pageSize: 30 },
}