import "server-only";

import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import type { EvaluationAdapter, DirectionContext } from "./image-generation";
import type { ProviderHealth } from "@/types/provider";
import { evaluationResultSchema } from "@/lib/schemas/evaluation";

const ANTHROPIC_EVAL_MODEL = "claude-sonnet-4-6" as const;

function buildEvaluationPrompt(
  direction: DirectionContext,
  rubricWeights: Record<string, number>
): string {
  return `You are evaluating an AI-generated image for a music release cover.
Score each criterion 0-1 based on the target direction.

Target direction:
- Mood: ${direction.moodLabel}
- Color palette: ${direction.colorPalette.join(", ")}
- Description: ${direction.description}
- Visual spec: ${direction.visualSpecSummary}

Criteria:
1. Composition (${rubricWeights.composition ?? 0.25}): Layout, balance, focal point
2. Color accuracy (${rubricWeights.colorAccuracy ?? 0.2}): Match to target palette
3. Mood alignment (${rubricWeights.moodAlignment ?? 0.2}): Emotional resonance with target mood
4. Text accuracy (${rubricWeights.textAccuracy ?? 0.2}): Any text elements are legible and appropriate
5. Brand consistency (${rubricWeights.brandConsistency ?? 0.15}): Cohesion with the overall direction

Return structured evaluation with scores and specific feedback.`;
}

export const anthropicEvaluationAdapter: EvaluationAdapter = {
  async evaluate(imageUrl, rubric, directionContext) {
    const start = Date.now();

    const systemPrompt = buildEvaluationPrompt(directionContext, rubric);

    const { object, usage } = await generateObject({
      model: anthropic(ANTHROPIC_EVAL_MODEL),
      schema: evaluationResultSchema,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", image: new URL(imageUrl) },
            {
              type: "text",
              text: "Evaluate this image against the criteria described in the system prompt.",
            },
          ],
        },
      ],
    });

    const durationMs = Date.now() - start;
    // Claude Sonnet: ~$3/1M input, $15/1M output
    const inputCost = ((usage.inputTokens ?? 0) / 1_000_000) * 300;
    const outputCost = ((usage.outputTokens ?? 0) / 1_000_000) * 1500;
    const costCents = Math.round((inputCost + outputCost) * 100) / 100;

    return { result: object, costCents, durationMs };
  },

  async getHealth(): Promise<ProviderHealth> {
    return {
      status: "healthy",
      lastChecked: new Date(),
      latencyMs: null,
      errorCount: 0,
    };
  },

  estimateCost(): number {
    return 2; // ~2 cents per evaluation
  },
};
