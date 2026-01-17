# Mastering Academia

Research tools for MPH (Master of Public Health) students and researchers. Free, no login required.

## Tools

- **Literature Search** - Search PubMed, OpenAlex, medRxiv simultaneously
- **PRISMA Generator** - Auto-generate PRISMA 2020 flow diagrams
- **Deduplication Tool** - Remove duplicates across databases
- **Screening Tracker** - Track include/exclude decisions
- **Data Extraction** - Customizable extraction forms
- **Search Monitor** - Get alerts for new matching papers

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **API**: Cloudflare Workers
- **Database**: Supabase (PostgreSQL)

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

## Deployment

### Frontend (Cloudflare Pages)

```bash
npm run pages:deploy
```

Or connect to Cloudflare Pages via GitHub integration.

### API (Cloudflare Workers)

```bash
cd api
npm install
npm run deploy
```

## Project Structure

```
├── app/              # Next.js app router pages
├── components/       # React components
├── hooks/            # Custom React hooks
├── lib/              # Utility functions
├── api/              # Cloudflare Workers API
├── supabase/         # Database schemas
└── scripts/          # Build/deploy scripts
```

## License

MIT
