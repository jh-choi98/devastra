import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://devastra.app'
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/auth/', '/settings', '/onboarding/', '/unsubscribe'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
