import "server-only";

import { db } from "@/server/db";
import { artistMessages } from "@/server/db/schema/artist-messages";
import { desc, eq } from "drizzle-orm";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

import {
  messageInputsSchema,
  messageOutputSchema,
  messageQuestionsSchema,
  messageSectionOutputSchema,
  type MessageInputs,
  type MessageOutput,
  type MessageQuestions,
  type MessageSectionKey,
} from "@/lib/schemas/message";
import { getUserSettings } from "@/server/services/user";
import { getCachedArtist } from "@/server/services/spotify-sync";
import {
  QUESTIONS_MODEL,
  SYNTHESIS_MODEL,
  QUESTIONS_SYSTEM_PROMPT,
  SYNTHESIS_SYSTEM_PROMPT,
  SECTION_REGEN_SYSTEM_PROMPT,
} from "@/server/services/message-prompts";

type ArtistContext = {
  name: string;
  genres: string[] | null;
  audioProfile: {
    energy: number;
    valence: number;
    danceability: number;
    acousticness: number;
    instrumentalness: number;
    tempo: number;
    loudness: number;
  } | null;
  albums: Array<{ name: string; releaseDate: string; albumType: string }>;
};

function buildArtistContextString(artist: ArtistContext): string {
  const parts: string[] = [];
  parts.push(`Artist: ${artist.name}`);
  if (artist.genres?.length) parts.push(`Genres: ${artist.genres.join(", ")}`);
  if (artist.audioProfile) {
    const ap = artist.audioProfile;
    parts.push(
      `Audio Profile: energy ${ap.energy.toFixed(2)}, valence ${ap.valence.toFixed(2)}, danceability ${ap.danceability.toFixed(2)}, acousticness ${ap.acousticness.toFixed(2)}, tempo ${ap.tempo.toFixed(0)}bpm`
    );
  }
  if (artist.albums.length) {
    const recent = artist.albums.slice(0, 8);
    parts.push(
      `Recent releases: ${recent.map((a) => `${a.name} (${a.releaseDate})`).join(", ")}`
    );
  }
  return parts.join("\n");
}

async function loadArtistContext(userId: string): Promise<ArtistContext> {
  const settings = await getUserSettings(userId);
  if (!settings.artistId) {
    throw new Error(
      "No Spotify artist linked — connect an artist before generating a message"
    );
  }
  const artist = await getCachedArtist(settings.artistId);
  if (!artist) {
    throw new Error(`Cached artist not found for artistId: ${settings.artistId}`);
  }
  return artist;
}

export async function generateQuestions(
  userId: string
): Promise<MessageQuestions> {
  const start = Date.now();
  const artist = await loadArtistContext(userId);
  const artistPrompt = buildArtistContextString(artist);

  const { object, usage } = await generateObject({
    model: openai(QUESTIONS_MODEL),
    schema: messageQuestionsSchema,
    system: QUESTIONS_SYSTEM_PROMPT,
    prompt: artistPrompt,
  });

  const inputCost = ((usage.inputTokens ?? 0) / 1_000_000) * 200;
  const outputCost = ((usage.outputTokens ?? 0) / 1_000_000) * 800;
  console.info(
    JSON.stringify({
      event: "message_questions_llm_complete",
      userId,
      costCents: Math.round((inputCost + outputCost) * 100) / 100,
      durationMs: Date.now() - start,
    })
  );

  return object;
}

export async function submitAnswers(
  userId: string,
  inputs: MessageInputs
): Promise<{ id: string; output: MessageOutput }> {
  const start = Date.now();
  const validInputs = messageInputsSchema.parse(inputs);
  const artist = await loadArtistContext(userId);
  const artistPrompt = buildArtistContextString(artist);

  const synthesisPrompt = `${artistPrompt}

ARTIST ANSWERS:
${JSON.stringify(validInputs, null, 2)}`;

  const { object: output, usage } = await generateObject({
    model: openai(SYNTHESIS_MODEL),
    schema: messageOutputSchema,
    system: SYNTHESIS_SYSTEM_PROMPT,
    prompt: synthesisPrompt,
  });

  const [row] = await db
    .insert(artistMessages)
    .values({
      userId,
      inputs: validInputs,
      output,
    })
    .returning({ id: artistMessages.id });

  const inputCost = ((usage.inputTokens ?? 0) / 1_000_000) * 200;
  const outputCost = ((usage.outputTokens ?? 0) / 1_000_000) * 800;
  console.info(
    JSON.stringify({
      event: "message_synthesis_llm_complete",
      userId,
      messageId: row.id,
      costCents: Math.round((inputCost + outputCost) * 100) / 100,
      durationMs: Date.now() - start,
    })
  );

  return { id: row.id, output };
}

export async function regenerateSection(
  userId: string,
  sectionKey: MessageSectionKey,
  feedback: string
): Promise<MessageOutput> {
  const start = Date.now();
  const existing = await getActiveMessage(userId);
  if (!existing) {
    throw new Error("No active message to regenerate from");
  }
  const artist = await loadArtistContext(userId);
  const artistPrompt = buildArtistContextString(artist);

  const userPrompt = `${artistPrompt}

CURRENT MESSAGE:
${JSON.stringify(existing.output, null, 2)}

SECTION TO REWRITE: ${sectionKey}

ARTIST FEEDBACK:
${feedback}`;

  const { object, usage } = await generateObject({
    model: openai(SYNTHESIS_MODEL),
    schema: messageSectionOutputSchema,
    system: SECTION_REGEN_SYSTEM_PROMPT,
    prompt: userPrompt,
  });

  const merged: MessageOutput = {
    ...existing.output,
    [sectionKey]: object.content,
  };

  await db
    .update(artistMessages)
    .set({ output: merged, updatedAt: new Date() })
    .where(eq(artistMessages.id, existing.id));

  const inputCost = ((usage.inputTokens ?? 0) / 1_000_000) * 200;
  const outputCost = ((usage.outputTokens ?? 0) / 1_000_000) * 800;
  console.info(
    JSON.stringify({
      event: "message_section_regen_llm_complete",
      userId,
      messageId: existing.id,
      sectionKey,
      costCents: Math.round((inputCost + outputCost) * 100) / 100,
      durationMs: Date.now() - start,
    })
  );

  return merged;
}

export async function getActiveMessage(userId: string): Promise<{
  id: string;
  inputs: MessageInputs;
  output: MessageOutput;
  createdAt: Date;
} | null> {
  const [row] = await db
    .select()
    .from(artistMessages)
    .where(eq(artistMessages.userId, userId))
    .orderBy(desc(artistMessages.createdAt))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    inputs: row.inputs as MessageInputs,
    output: row.output as MessageOutput,
    createdAt: row.createdAt,
  };
}
