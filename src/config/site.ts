// Everything personal lives here. Empty strings are hidden on the site.
export const site = {
  name: 'Echezonachi Collins UGWUJA',
  first: 'Echezonachi',
  rest: 'Collins Ugwuja',
  subtitle: 'Video Edits · Developer · Engineer',
  tagline: "A collection of things I've created.",
  available: true,
  hero: {
    desktop: '/images/robot.jpg',
    mobile: '/images/hero.jpg',
    posDesktop: 'center 50%',
    posMobile: 'center top',
  },
  
  socials: { whatsapp: '', instagram: '', portfolio: '', linkedin: '', github: '' } as Record<string, string>,
  about: {
    text: 'I work across digital design, web development, application development and technical projects.',
    skills: ['Graphic design', 'Video editing', 'Web development', 'UI/UX design', 'Mini apps', 'Embedded systems'],
  },
  limits: { imageMB: 15, videoMB: 50, pageSize: 30 },
}
