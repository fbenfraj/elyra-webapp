import "server-only";

import { RETRY_CONFIG } from "@/config/providers";
import { canExecute, recordSuccess, recordFailure } from "@/server/services/circuit-breaker";
import { db } from "@/server/db";
import { providerMetrics } from "@/server/db/schema/provider-metrics";

export class AllProvidersFailedError extends Error {
  constructor(
    public readonly providers: string[],
    public readonly lastError: Error
  ) {
    super(`All providers failed: ${providers.join(", ")}. Last error: ${lastError.message}`);
    this.name = "AllProvidersFailedError";
  }
}

export async function executeWithFallback<T>(
  chain: readonly string[],
  executeFn: (provider: string) => Promise<T>,
  context?: { sessionId?: string }
): Promise<T> {
  let lastError: Error | null = null;

  for (const provider of chain) {
    // Check circuit breaker
    if (!canExecute(provider)) {
      console.warn(JSON.stringify({
        event: "provider_skipped_circuit_open",
        provider,
        sessionId: context?.sessionId,
        timestamp: new Date().toISOString(),
      }));
      continue;
    }

    const config = RETRY_CONFIG[provider] ?? { maxRetries: 2, retryDelayMs: 1000, timeoutMs: 30_000 };

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      const attemptStart = Date.now();
      try {
        const result = await executeFn(provider);
        recordSuccess(provider);

        // Fire-and-forget metrics recording
        void db.insert(providerMetrics).values({
          provider,
          model: "unknown",
          durationMs: Date.now() - attemptStart,
          costCents: 0,
          success: true,
          sessionId: context?.sessionId,
        }).catch(err => console.error("Failed to record provider metric", err));

        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Fire-and-forget metrics recording
        void db.insert(providerMetrics).values({
          provider,
          model: "unknown",
          durationMs: Date.now() - attemptStart,
          costCents: 0,
          success: false,
          errorType: lastError.message.slice(0, 200),
          sessionId: context?.sessionId,
        }).catch(metricsErr => console.error("Failed to record provider metric", metricsErr));

        if (attempt < config.maxRetries) {
          const delay = Math.min(config.retryDelayMs * Math.pow(2, attempt), 10_000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted for this provider
    recordFailure(provider);

    const nextProvider = chain[chain.indexOf(provider) + 1];
    if (nextProvider) {
      console.warn(JSON.stringify({
        event: "provider_fallback",
        provider,
        failureReason: lastError?.message,
        fallbackProvider: nextProvider,
        sessionId: context?.sessionId,
        timestamp: new Date().toISOString(),
      }));
    }
  }

  throw new AllProvidersFailedError(
    [...chain],
    lastError ?? new Error("No providers available")
  );
}
