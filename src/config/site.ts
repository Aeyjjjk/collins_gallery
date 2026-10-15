// Everything personal lives here. Empty strings are hidden on the site.
export const site = {
  name: 'Echezonachi Collins UGWUJA',
  first: 'Echezonachi',
  rest: 'Collins Ugwuja',
  subtitle: 'Digital Creator · Developer · Engineer',
  tagline: "A collection of things I've created.",
  available: true,
  hero: {
    desktop: '/images/profile-hero.webp', // put your photo in public/images/
    mobile: '', // optional portrait crop, e.g. '/images/profile-hero-mobile.webp'
    posDesktop: 'center 25%',
    posMobile: 'center top',
  },
  // Only platforms with a value are shown, in this order.
  // whatsapp: number with country code, digits only (e.g. '2348012345678'), or a full https://wa.me/... link
  // portfolio / instagram / linkedin / github: full profile URL (https://...)
  socials: { whatsapp: '', instagram: '', portfolio: '', linkedin: '', github: '' } as Record<string, string>,
  about: {
    text: 'I work across digital design, web development, application development and technical projects.',
    skills: ['Graphic design', 'Video editing', 'Web development', 'UI/UX design', 'Mini apps', 'Embedded systems'],
  },
  limits: { imageMB: 15, videoMB: 50, pageSize: 30 },
}
