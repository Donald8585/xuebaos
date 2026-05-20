# XueBaOS Deployment Checklist

## R2 Buckets

The API Worker requires these R2 bindings declared in `apps/api/wrangler.toml`:

| Binding  | Bucket Name         | Purpose                              |
|----------|---------------------|--------------------------------------|
| `STORAGE`| `xuebaos-storage`   | General file storage (videos, palaces, uploads) |
| `ASSETS` | `xuebaos-assets`    | Legacy/general assets                |
| `IMAGES` | `xuebaos-images`    | Thumbnails, scene captures           |

### ⚠️ If you get `TypeError: Cannot read properties of undefined (reading 'put')`

This means a binding referenced in code is missing from `wrangler.toml`. Check:

1. All 3 R2 buckets exist (`wrangler r2 bucket list`)
2. All 3 bindings are declared under `[[env.production.r2_buckets]]`
3. The `Env` interface in `apps/api/src/index.ts` includes all 3: `STORAGE`, `ASSETS`, `IMAGES`

### Creating a missing bucket

```bash
wrangler r2 bucket create xuebaos-storage
```

Then add the binding to `wrangler.toml` and redeploy.

## D1 Database

| Binding | Database       | ID                                   |
|---------|----------------|--------------------------------------|
| `DB`    | `xuebaos-db`   | `833d098b-f5c8-4744-974f-d723ce73f228` |

## Deploy Commands

```bash
# API Worker
cd apps/api && wrangler deploy --env production

# Web (Cloudflare Pages)
cd apps/web && npm run build && wrangler pages deploy dist --project-name xuebaos
```

## Queue Consumer

The queue consumer for `xuebaos-ai-jobs` is configured manually in the Cloudflare dashboard (not in wrangler.toml) to avoid duplicate consumer errors. If the queue consumer stops working, check the Cloudflare Dashboard → Workers & Pages → xuebaos-api → Triggers → Queues.

## Secrets (set via `wrangler secret put`)

- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `DEEPSEEK_API_KEY`
- `REPLICATE_API_TOKEN`
- `OPENAI_API_KEY`
- `ELEVENLABS_API_KEY`
- `RESEND_API_KEY`
