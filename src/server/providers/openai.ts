import "server-only";

import { generateObject, generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import {
  interpretationResponseSchema,
  type InterpretationResponse,
} from "@/lib/schemas/visual-spec";
import {
  evaluationResultSchema,
  type EvaluationResult,
} from "@/lib/schemas/evaluation";
import { INTERPRETATION_MODEL } from "@/config/providers";
import { RUBRIC_WEIGHTS } from "@/config/evaluation";
import type { EvaluationAdapter, DirectionContext } from "./image-generation";

const INTERPRETATION_SYSTEM_PROMPT = `You are a visual interpretation engine for music artists. Your job is to translate a natural language creative brief into a structured visual specification.

CRITICAL RULES:
- Genre context matters deeply. "dark trap" and "dark ambient" are different cultural worlds with entirely different visual languages. A trap brief should evoke urban grit, neon, shadows. An ambient brief should evoke vast landscapes, ethereal textures, fog.
- Cultural references are clues. "like Arca album covers" means experimental, distorted, fluid forms. "like Travis Scott's Astroworld" means psychedelic, surreal, maximalist. Map artist references to specific visual attributes.
- Continuity cues like "similar to my last release, but softer" indicate the artist wants evolution, not revolution. Acknowledge these cues in the spec even if you don't have access to prior work.
- Be specific and concrete in your output. "moody" is too vague. "Low-key lighting with deep shadows and desaturated cool tones" is actionable.
- The palette should be 4-6 hex colors that define the visual world.
- The mood should capture the emotional atmosphere in 3-5 words.
- The composition should describe spatial arrangement, perspective, and framing.
- The style should specify the visual treatment (photographic, illustrated, collage, etc.) with specificity.
- Cultural references should list the most relevant visual touchpoints extracted from the brief.
- Genre context should name the specific music genre/subgenre driving the visual language.

CONFIDENCE ASSESSMENT:
- Rate your confidence (0-1) that the brief has enough specificity for 2-3 differentiated creative directions.
- If confidence < 0.7, return 1-2 follow-up questions as conversational nudges and omit the spec.
- If confidence >= 0.7, provide the full visual specification and set followUpQuestions to an empty array.
- Questions should sound like a creative director: "More gritty or more polished?", "Any artist or album cover that captures this feeling?"
- NEVER ask generic questions. Tailor them to what is missing from the brief.`;

export async function interpretBrief(briefText: string): Promise<{
  response: InterpretationResponse;
  costCents: number;
  durationMs: number;
}> {
  const start = Date.now();

  const { object, usage } = await generateObject({
    model: openai(INTERPRETATION_MODEL),
    schema: interpretationResponseSchema,
    system: INTERPRETATION_SYSTEM_PROMPT,
    prompt: briefText,
  });

  const durationMs = Date.now() - start;
  // GPT-4.1: $2/1M input, $8/1M output
  const inputCost = ((usage.inputTokens ?? 0) / 1_000_000) * 200;
  const outputCost = ((usage.outputTokens ?? 0) / 1_000_000) * 800;
  const costCents = Math.round((inputCost + outputCost) * 100) / 100;

  console.info(JSON.stringify({
    event: "provider_call",
    provider: "openai",
    model: INTERPRETATION_MODEL,
    durationMs,
    success: true,
  }));

  return {
    response: object,
    costCents,
    durationMs,
  };
}

// Only block categories specified in AC #3
const BLOCKED_CATEGORY_PREFIXES = [
  "violence",
  "sexual",
  "self-harm",
  "illicit",
] as const;

export async function moderateBrief(
  briefText: string
): Promise<{ flagged: boolean; categories: string[] }> {
  const response = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ input: briefText }),
  });

  if (!response.ok) {
    // If moderation API fails, allow the brief through rather than blocking
    return { flagged: false, categories: [] };
  }

  const data = (await response.json()) as {
    results: Array<{
      categories: Record<string, boolean>;
    }>;
  };

  const result = data.results[0];
  if (!result) {
    return { flagged: false, categories: [] };
  }

  const blockedCategories = Object.entries(result.categories)
    .filter(
      ([category, flagged]) =>
        flagged &&
        BLOCKED_CATEGORY_PREFIXES.some((prefix) =>
          category.startsWith(prefix)
        )
    )
    .map(([category]) => category);

  return {
    flagged: blockedCategories.length > 0,
    categories: blockedCategories,
  };
}

// DirectionContext is re-exported from image-generation.ts for backward compatibility
export type { DirectionContext } from "./image-generation";

/** VLM evaluation model */
const EVALUATION_MODEL = "gpt-4o" as const;

/** Prompt refinement model */
const REFINEMENT_MODEL = "gpt-4.1" as const;

function buildEvaluationSystemPrompt(
  direction: DirectionContext,
  rubricWeights: typeof RUBRIC_WEIGHTS
): string {
  return `You are evaluating an AI-generated image for a music release cover.
Score each criterion 0-1 based on the target direction.

Target direction:
- Mood: ${direction.moodLabel}
- Color palette: ${direction.colorPalette.join(", ")}
- Description: ${direction.description}
- Visual spec: ${direction.visualSpecSummary}

Criteria:
1. Composition (${rubricWeights.composition}): Layout, balance, focal point
2. Color accuracy (${rubricWeights.colorAccuracy}): Match to target palette
3. Mood alignment (${rubricWeights.moodAlignment}): Emotional resonance with target mood
4. Text accuracy (${rubricWeights.textAccuracy}): Any text elements are legible and appropriate
5. Brand consistency (${rubricWeights.brandConsistency}): Cohesion with the overall direction

Return structured evaluation with scores and specific feedback.`;
}

export async function evaluateImage(
  imageUrl: string,
  directionContext: DirectionContext,
  rubricWeights: typeof RUBRIC_WEIGHTS = RUBRIC_WEIGHTS
): Promise<{
  result: EvaluationResult;
  costCents: number;
  durationMs: number;
}> {
  const start = Date.now();

  const systemPrompt = buildEvaluationSystemPrompt(
    directionContext,
    rubricWeights
  );

  const { object, usage } = await generateObject({
    model: openai(EVALUATION_MODEL),
    schema: evaluationResultSchema,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: new URL(imageUrl),
          },
          {
            type: "text",
            text: "Evaluate this image against the criteria described in the system prompt.",
          },
        ],
      },
    ],
  });

  const durationMs = Date.now() - start;
  // GPT-4o: $2.50/1M input, $10/1M output
  const inputCost = ((usage.inputTokens ?? 0) / 1_000_000) * 250;
  const outputCost = ((usage.outputTokens ?? 0) / 1_000_000) * 1000;
  const costCents = Math.round((inputCost + outputCost) * 100) / 100;

  console.info(JSON.stringify({
    event: "provider_call",
    provider: "openai",
    model: EVALUATION_MODEL,
    durationMs,
    success: true,
  }));

  return {
    result: object,
    costCents,
    durationMs,
  };
}

export async function refinePromptWithFeedback(
  originalPrompt: string,
  feedback: EvaluationResult[]
): Promise<{
  refinedPrompt: string;
  costCents: number;
  durationMs: number;
}> {
  const start = Date.now();

  const weaknessSummary = feedback
    .flatMap((f) => f.weaknesses)
    .filter((w, i, arr) => arr.indexOf(w) === i)
    .join("\n- ");

  const scoreSummary = feedback
    .map((f, i) => {
      const s = f.scores;
      return `Image ${i + 1}: composition=${s.composition.toFixed(2)}, colorAccuracy=${s.colorAccuracy.toFixed(2)}, moodAlignment=${s.moodAlignment.toFixed(2)}, textAccuracy=${s.textAccuracy.toFixed(2)}, brandConsistency=${s.brandConsistency.toFixed(2)}, overall=${f.overallScore.toFixed(2)}`;
    })
    .join("\n");

  const { text, usage } = await generateText({
    model: openai(REFINEMENT_MODEL),
    system: `You are a prompt engineer refining an image generation prompt for a music release cover.
The previous batch of images did not meet quality standards. Analyze the weaknesses and scores,
then rewrite the prompt to address the identified issues.

Rules:
- Keep the core creative direction intact
- Add specific instructions to address each weakness
- If color accuracy is low, add more specific color hex codes and descriptions
- If mood alignment is low, add more emotional and atmospheric descriptors
- If composition is low, add explicit layout and framing instructions
- If text accuracy is low, reinforce "no text, no words, no letters" instructions
- If brand consistency is low, strengthen cohesion language
- Return ONLY the refined prompt text, nothing else`,
    prompt: `Original prompt:
${originalPrompt}

Evaluation scores:
${scoreSummary}

Identified weaknesses:
- ${weaknessSummary}

Rewrite the prompt to address these weaknesses while preserving the creative direction.`,
  });

  const durationMs = Date.now() - start;
  // GPT-4.1: $2/1M input, $8/1M output
  const inputCost = ((usage.inputTokens ?? 0) / 1_000_000) * 200;
  const outputCost = ((usage.outputTokens ?? 0) / 1_000_000) * 800;
  const costCents = Math.round((inputCost + outputCost) * 100) / 100;

  console.info(JSON.stringify({
    event: "provider_call",
    provider: "openai",
    model: REFINEMENT_MODEL,
    durationMs,
    success: true,
  }));

  return {
    refinedPrompt: text,
    costCents,
    durationMs,
  };
}

export const openaiEvaluationAdapter: EvaluationAdapter = {
  async evaluate(imageUrl, rubric, directionContext) {
    return evaluateImage(imageUrl, directionContext, rubric as typeof RUBRIC_WEIGHTS);
  },
  async getHealth() {
    return { status: "healthy" as const, lastChecked: new Date(), latencyMs: null, errorCount: 0 };
  },
  estimateCost() {
    return 3; // ~3 cents per evaluation
  },
};
