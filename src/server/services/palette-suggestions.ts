import "server-only";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

import {
  moodAnchorSuggestionsSchema,
  swatchSuggestionsSchema,
  neutralsSuggestionSchema,
  type MoodAnchor,
  type MoodAnchorSuggestions,
  type SwatchSuggestions,
  type NeutralsSuggestion,
} from "@/lib/schemas/palette";
import {
  loadArtistContext,
  buildArtistContextString,
} from "@/server/services/artist-context";
import { getActiveMessage } from "@/server/services/message";
import {
  PALETTE_MODEL,
  MOOD_ANCHOR_SYSTEM_PROMPT,
  DOMINANT_SYSTEM_PROMPT,
  ACCENT_SYSTEM_PROMPT,
  NEUTRALS_SYSTEM_PROMPT,
} from "@/server/services/palette-prompts";

async function buildContextPrompt(userId: string): Promise<string> {
  const artist = await loadArtistContext(userId);
  const artistPrompt = buildArtistContextString(artist);
  const message = await getActiveMessage(userId);

  if (!message) return artistPrompt;

  const messageBlock = `IDENTITY MESSAGE:
title: ${message.output.title}
narrative: ${message.output.narrative}
visualDirection: ${message.output.visualDirection}
aesthetic: ${message.output.aesthetic}`;

  return `${artistPrompt}\n\n${messageBlock}`;
}

function logCost(event: string, userId: string, durationMs: number, usage: {
  inputTokens?: number;
  outputTokens?: number;
}) {
  const inputCost = ((usage.inputTokens ?? 0) / 1_000_000) * 200;
  const outputCost = ((usage.outputTokens ?? 0) / 1_000_000) * 800;
  console.info(
    JSON.stringify({
      event,
      userId,
      costCents: Math.round((inputCost + outputCost) * 100) / 100,
      durationMs,
    })
  );
}

export async function suggestMoodAnchors(
  userId: string
): Promise<MoodAnchorSuggestions> {
  const start = Date.now();
  const prompt = await buildContextPrompt(userId);

  const { object, usage } = await generateObject({
    model: openai(PALETTE_MODEL),
    schema: moodAnchorSuggestionsSchema,
    system: MOOD_ANCHOR_SYSTEM_PROMPT,
    prompt,
  });

  logCost("palette_mood_anchors_llm_complete", userId, Date.now() - start, usage);
  return object;
}

export async function suggestDominant(
  userId: string,
  moodAnchor: MoodAnchor
): Promise<SwatchSuggestions> {
  const start = Date.now();
  const ctx = await buildContextPrompt(userId);
  const prompt = `${ctx}

CHOSEN MOOD ANCHOR:
${JSON.stringify(moodAnchor, null, 2)}`;

  const { object, usage } = await generateObject({
    model: openai(PALETTE_MODEL),
    schema: swatchSuggestionsSchema,
    system: DOMINANT_SYSTEM_PROMPT,
    prompt,
  });

  logCost("palette_dominant_llm_complete", userId, Date.now() - start, usage);
  return object;
}

export async function suggestAccent(
  userId: string,
  moodAnchor: MoodAnchor,
  dominant: string
): Promise<SwatchSuggestions> {
  const start = Date.now();
  const ctx = await buildContextPrompt(userId);
  const prompt = `${ctx}

CHOSEN MOOD ANCHOR:
${JSON.stringify(moodAnchor, null, 2)}

LOCKED DOMINANT: ${dominant}`;

  const { object, usage } = await generateObject({
    model: openai(PALETTE_MODEL),
    schema: swatchSuggestionsSchema,
    system: ACCENT_SYSTEM_PROMPT,
    prompt,
  });

  logCost("palette_accent_llm_complete", userId, Date.now() - start, usage);
  return object;
}

export async function suggestNeutrals(
  userId: string,
  moodAnchor: MoodAnchor,
  dominant: string,
  accent: string
): Promise<NeutralsSuggestion> {
  const start = Date.now();
  const ctx = await buildContextPrompt(userId);
  const prompt = `${ctx}

CHOSEN MOOD ANCHOR:
${JSON.stringify(moodAnchor, null, 2)}

LOCKED DOMINANT: ${dominant}
LOCKED ACCENT: ${accent}`;

  const { object, usage } = await generateObject({
    model: openai(PALETTE_MODEL),
    schema: neutralsSuggestionSchema,
    system: NEUTRALS_SYSTEM_PROMPT,
    prompt,
  });

  logCost("palette_neutrals_llm_complete", userId, Date.now() - start, usage);
  return object;
}
