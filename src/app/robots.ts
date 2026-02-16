import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  // The app root (/) is not public; public websites live under /s/[slug].
  // Block everything by default and allow only /s/.
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/s/"],
        disallow: ["/"],
      },
    ],
  }
}

