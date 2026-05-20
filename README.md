# XueBaOS — AI-Powered Study Operating System

Monorepo: `apps/web` (React/Vite frontend) + `apps/api` (Cloudflare Workers/Hono backend).

## How Memory Palace Handles Large Documents

XueBaOS uses a **chunked streaming pipeline** to generate memory loci from documents of any size:

| Document Size | Strategy | Latency |
|---|---|---|
| <100KB (~25K tokens) | Single synchronous LLM call | ~5-15s |
| >100KB | Chunked queue + SSE streaming | ~30s-5min |

### Pipeline

1. **Upload** → document parsed to plaintext (TXT/MD native; PDF/DOCX via R2)
2. **Chunk** → semantic sectioning by headings, paragraphs, sentence fallback; 1500-3000 token target windows with context overlap
3. **Queue** → chunks dispatched to Cloudflare Queues in batches of 10
4. **Generate** → per-chunk DeepSeek Chat with auto-fallback to OpenAI GPT-4o-mini
5. **Stream** → SSE pushes loci to the UI progressively; progress bar + live preview
6. **Collect** → all loci assembled, resumable on reconnect

### Resilience

- **Reconnect**: SSE auto-reconnects on connection loss (3s delay)
- **Retry**: Failed chunks get 3 retries with exponential backoff (1s→60s)
- **Fallback**: Switches to OpenAI after 3 consecutive DeepSeek failures
- **Cost cap**: Per-tier limits (Free: HK$1, Pro: HK$10, Founder: HK$50)
- **Cleanup**: Cron every 6h removes stale jobs >24h; R2 lifecycle expires uploads after 7 days

### API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/loci-jobs` | POST | Submit document for chunked processing |
| `/api/loci-jobs/:id` | GET | Job status + collected loci |
| `/api/loci-jobs/:id/stream` | GET | SSE progress stream |
| `/api/loci-jobs/:id/retry-chunks` | POST | Retry failed chunks |
| `/api/loci-jobs/estimate-cost` | POST | Token count + cost estimate |
| `/api/ai/generate-palace` | POST | Fast path for small documents (<100KB) |

Architecture docs: [`docs/memory-palace-pipeline.md`](docs/memory-palace-pipeline.md)

## Quick Start

```bash
# Install
npm install
cd apps/api && npm install && cd ../..
cd apps/web && npm install && cd ../..

# Dev
npm run dev          # both API + web concurrently

# Deploy
cd apps/api && wrangler deploy --env production
cd apps/web && npm run build && wrangler pages deploy dist --project-name xuebaos
```

## Environment

Copy `.env.example` → `.env` and fill in values. See `DEPLOY.md` for full deployment checklist.

## Tech Stack

- **Frontend**: React, Vite, Tailwind, Clerk Auth, Stripe
- **Backend**: Hono, Drizzle ORM, Cloudflare Workers
- **Storage**: D1 (SQLite), R2 (objects), KV (cache), Queues (async jobs)
- **AI**: DeepSeek Chat (primary), OpenAI GPT-4o-mini (fallback)
