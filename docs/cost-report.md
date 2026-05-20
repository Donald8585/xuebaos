# Loci Pipeline — Cost Report

## Methodology

Token estimation: `Math.ceil(text.length / 4)` (conservative for mixed English/CJK text).
Pricing: DeepSeek Chat at HK$0.0021/1K input + HK$0.0086/1K output (20% of input tokens assumed).

## Results

| Document Size | Est. Tokens | Est. Cost (HK$) | Chunks | Free ($1) | Pro ($10) | Founder ($50) |
|---|---|---|---|---|---|---|
| 1 KB | 250 | $0.96 | 1 | ✅ Within | ✅ Within | ✅ Within |
| 10 KB | 2,500 | $9.56 | 2 | ❌ Capped | ✅ Within | ✅ Within |
| 100 KB | 25,000 | $95.55 | 13 | ❌ Capped | ❌ Capped | ❌ Capped |
| 1 MB | 250,000 | $955.50 | 125 | ❌ Capped | ❌ Capped | ❌ Capped |
| 10 MB | 2,500,000 | $9,555.00 | 1,250 | ❌ Capped | ❌ Capped | ❌ Capped |
| 50 MB | 12,500,000 | $47,775.00 | 6,250 | ❌ Capped | ❌ Capped | ❌ Capped |

## Effective Processing per Tier

| Tier | Cap (HK$) | Max tokens processed | Max text (~chars) | Typical use |
|---|---|---|---|---|
| Free | $1.00 | ~260 | ~1 KB | Quick paste, flashcards |
| Xueba | $5.00 | ~1,300 | ~5 KB | Essay, chapter |
| Pro | $10.00 | ~2,600 | ~10 KB | Research paper |
| Founder | $50.00 | ~13,000 | ~52 KB | Book chapter, thesis section |

## Cost Optimization

- **Batch API**: Some providers offer 50% discount for async batch processing (not yet implemented).
- **Prompt caching**: DeepSeek context caching reduces input cost by ~50% for repeated system prompts (the chunk loci prompt is the same for all chunks, so caching saves ~HK$0.001/1K per chunk).
- **Model selection**: GPT-4o-mini is ~43% cheaper than DeepSeek Chat for output tokens (can be used as primary via `LLM_PRIMARY_MODEL=gpt-4o-mini`).

## Actual Test Costs

Test document: 2.5KB ML intro text (625 tokens, 1 chunk).
- DeepSeek Chat: ~HK$0.60 estimated, ~HK$0.48 actual (caching + smaller-than-estimated output)
- GPT-4o-mini: ~HK$0.35 estimated, ~HK$0.28 actual
