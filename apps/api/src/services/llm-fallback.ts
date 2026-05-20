/**
 * LLM provider fallback with exponential backoff + jitter.
 *
 * Primary: DeepSeek Chat ($0.27/M input, fast, cheap)
 * Fallback: OpenAI GPT-4o-mini ($0.15/M input, compatible API)
 *
 * Handles: rate limits (429), server errors (5xx), timeouts.
 * Backoff: 1s → 2s → 4s → 8s → 16s → 32s → 60s (max) with ±25% jitter.
 * Switch provider after 3 consecutive failures.
 */

import type { Env } from "../index";
import type { ChatMessage } from "./ai";

const DEEPSEEK_BASE = "https://api.deepseek.com/v1";
const OPENAI_BASE = "https://api.openai.com/v1";

interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKey: string | undefined;
  model: string;
}

/** Get available providers in priority order */
function getProviders(env: Env): ProviderConfig[] {
  const providers: ProviderConfig[] = [];

  if (env.DEEPSEEK_API_KEY) {
    providers.push({
      name: "deepseek",
      baseUrl: DEEPSEEK_BASE,
      apiKey: env.DEEPSEEK_API_KEY,
      model: env.LLM_PRIMARY_MODEL || "deepseek-chat",
    });
  }

  if (env.OPENAI_API_KEY) {
    providers.push({
      name: "openai",
      baseUrl: OPENAI_BASE,
      apiKey: env.OPENAI_API_KEY,
      model: env.LLM_FALLBACK_MODEL || "gpt-4o-mini",
    });
  }

  return providers;
}

/** Compute backoff delay with jitter */
function backoffDelay(attempt: number): number {
  const base = Math.min(1000 * Math.pow(2, attempt), 60000); // 1s → 60s max
  const jitter = base * (0.5 + Math.random() * 0.5); // ±25%
  return Math.round(jitter);
}

interface FallbackResult {
  content: string;
  provider: string;
  attempts: number;
  totalMs: number;
}

const MAX_ATTEMPTS = 6;
const SWITCH_AFTER_FAILURES = 3;

/**
 * Call LLM with automatic provider fallback and backoff.
 * Returns content string + metadata about which provider was used.
 */
export async function chatWithFallback(
  env: Env,
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<FallbackResult> {
  const providers = getProviders(env);
  if (providers.length === 0) {
    throw new Error("No LLM provider configured — set DEEPSEEK_API_KEY or OPENAI_API_KEY");
  }

  const startedAt = Date.now();
  let currentProviderIdx = 0;
  let consecutiveFailures = 0;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const provider = providers[currentProviderIdx];

    try {
      const resp = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 2048,
          stream: false,
        }),
      });

      if (resp.status === 429) {
        // Rate limited — backoff and retry same provider
        consecutiveFailures++;
        const delay = backoffDelay(attempt);
        console.warn(`[llm-fallback] ${provider.name} rate-limited (attempt ${attempt + 1}/${MAX_ATTEMPTS}), waiting ${delay}ms`);

        if (consecutiveFailures >= SWITCH_AFTER_FAILURES && currentProviderIdx + 1 < providers.length) {
          currentProviderIdx++;
          consecutiveFailures = 0;
          console.warn(`[llm-fallback] Switching to ${providers[currentProviderIdx].name}`);
        }

        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        consecutiveFailures++;
        console.error(`[llm-fallback] ${provider.name} HTTP ${resp.status}: ${errText.slice(0, 200)}`);

        if (resp.status >= 500 || consecutiveFailures >= SWITCH_AFTER_FAILURES) {
          if (currentProviderIdx + 1 < providers.length) {
            currentProviderIdx++;
            consecutiveFailures = 0;
            console.warn(`[llm-fallback] Switching to ${providers[currentProviderIdx].name} after ${provider.name} failure`);
            continue;
          }
        }

        if (attempt + 1 < MAX_ATTEMPTS) {
          await new Promise(r => setTimeout(r, backoffDelay(attempt)));
          continue;
        }
        throw new Error(`${provider.name} HTTP ${resp.status}: ${errText.slice(0, 200)}`);
      }

      // Success
      const data = (await resp.json()) as { choices: Array<{ message: { content: string } }> };
      const content = data.choices?.[0]?.message?.content ?? "";

      return {
        content,
        provider: provider.name,
        attempts: attempt + 1,
        totalMs: Date.now() - startedAt,
      };

    } catch (e: any) {
      // Network error — backoff
      consecutiveFailures++;
      console.error(`[llm-fallback] ${provider.name} network error: ${String(e?.message ?? "").slice(0, 200)}`);

      if (consecutiveFailures >= SWITCH_AFTER_FAILURES && currentProviderIdx + 1 < providers.length) {
        currentProviderIdx++;
        consecutiveFailures = 0;
      }

      if (attempt + 1 < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, backoffDelay(attempt)));
        continue;
      }
      throw e;
    }
  }

  throw new Error(`All LLM providers failed after ${MAX_ATTEMPTS} attempts`);
}
