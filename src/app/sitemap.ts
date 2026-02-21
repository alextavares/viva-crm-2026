import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.vivacrm.com.br'

    return [
        {
            url: origin,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 1,
        },
        {
            url: `${origin}/precos`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.9,
        },
        {
            url: `${origin}/login`,
            lastModified: new Date(),
            changeFrequency: 'yearly',
            priority: 0.5,
        },
        {
            url: `${origin}/register`,
            lastModified: new Date(),
            changeFrequency: 'yearly',
            priority: 0.8,
        },
    ]
}
