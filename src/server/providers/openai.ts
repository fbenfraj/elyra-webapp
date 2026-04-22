import "server-only";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import {
  interpretationResponseSchema,
  type InterpretationResponse,
} from "@/lib/schemas/visual-spec";
import { INTERPRETATION_MODEL } from "@/config/providers";

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
