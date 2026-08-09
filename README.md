# TiredChefOnline

Static marketing site for TiredChefOnline, deployed from the repository root.

## Local preview

1. Run `npm run preview`.
2. Open `http://127.0.0.1:8765/`.

The preview server has no package dependencies. Production deployment settings live in `netlify.toml`.

## Site structure

- `index.html` — homepage
- `services/` — individual Local SEO, Web Design, and Social Media pages
- `locations.html` — South Metro service areas
- `contact.html` — Netlify contact form and optional Calendly booking
- `privacy.html` — privacy policy
- `sitemap.html` and `sitemap.xml` — visitor and search-engine sitemaps
- `assets/css/site.css` — shared visual system
- `assets/js/site.js` — navigation, reveal effects, current year, and sitemap filtering

All production page and asset links are root-relative because the canonical site is `https://tiredchefonline.com/`.
