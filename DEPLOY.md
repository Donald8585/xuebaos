# XueBaOS Deployment Checklist

## R2 Buckets

The API Worker requires these R2 bindings in `apps/api/wrangler.toml`:

| Binding  | Bucket Name         | Purpose                              |
|----------|---------------------|--------------------------------------|
| `STORAGE`| `xuebaos-storage`   | General file storage (videos, palaces, uploads) |
| `ASSETS` | `xuebaos-assets`    | Legacy/general assets                |
| `IMAGES` | `xuebaos-images`    | Thumbnails, scene captures           |

⚠️ `TypeError: Cannot read properties of undefined (reading 'put')` → missing binding.

## D1 Database

| Binding | Database       | ID                                   |
|---------|----------------|--------------------------------------|
| `DB`    | `xuebaos-db`   | `833d098b-f5c8-4744-974f-d723ce73f228` |

Tables: users, memory_palaces, loci_jobs, loci_chunks, palace_videos, palace_anchors, +14 more.

## KV Namespace

| Binding | Namespace ID                       | Purpose                          |
|---------|------------------------------------|----------------------------------|
| `CACHE` | `105dde0b82f84d1e83fb469026a2fc71` | Job status cache, rate limiting  |

⚠️ If the binding name in wrangler.toml doesn't match `Env` interface: `undefined.put()` crash.

## Queue

| Queue            | Producer Binding | Consumer            | Purpose                  |
|------------------|-----------------|---------------------|--------------------------|
| `xuebaos-ai-jobs`| `AI_QUEUE`      | CF Dashboard manual | AI job processing        |

⚠️ Consumer is configured manually in Cloudflare Dashboard — DO NOT add `[[queues.consumers]]` to wrangler.toml or deploy fails with "already has a consumer" error.

## Cron Triggers

```toml
[env.production.triggers]
crons = ["0 */6 * * *"]  # Cleanup stale loci_jobs every 6 hours
```

## Loci Pipeline (Chunked Generation)

For documents >100KB, the Memory Palace loci generator uses a chunked pipeline:

```
Upload → Parse → Semantic Chunk → Queue → SSE Stream → Collect
```

### Endpoints

| Endpoint                           | Method | Purpose                          |
|------------------------------------|--------|----------------------------------|
| `/api/loci-jobs`                   | POST   | Submit doc, parse, chunk, enqueue|
| `/api/loci-jobs/:id`               | GET    | Job status + collected loci      |
| `/api/loci-jobs/:id/stream`        | GET    | SSE progress stream              |
| `/api/loci-jobs/:id/retry-chunks`  | POST   | Retry failed chunks              |
| `/api/loci-jobs/estimate-cost`     | POST   | Token count + cost estimate      |

### Cost Caps (per tier)

| Tier     | Cap/job |
|----------|---------|
| free     | HK$1.00 |
| xueba    | HK$5.00 |
| pro      | HK$10.00 |
| founder  | HK$50.00 |

LLM pricing: DeepSeek Chat ~HK$0.0021/1K input tokens, ~HK$0.0086/1K output.

### Provider Fallback

Primary: DeepSeek Chat → Fallback: OpenAI GPT-4o-mini (if OPENAI_API_KEY set).
Switches after 3 consecutive failures. Exponential backoff: 1s→60s with jitter.

## Deploy Commands

```bash
# API Worker
cd apps/api && wrangler deploy --env production

# Web (Cloudflare Pages)
cd apps/web && npm run build && wrangler pages deploy dist --project-name xuebaos

# DB Migration
cd apps/api && wrangler d1 execute xuebaos-db --remote --file=./drizzle/migrations/0007_loci_jobs_chunks.sql
```

## Secrets (set via `wrangler secret put`)

- `CLERK_SECRET_KEY` / `CLERK_WEBHOOK_SECRET`
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`
- `DEEPSEEK_API_KEY`
- `OPENAI_API_KEY` (fallback provider)
- `REPLICATE_API_TOKEN`
- `ELEVENLABS_API_KEY`
- `RESEND_API_KEY`
