import { z } from "zod/v4";

export const MESSAGE_SIGNALS = [
  "coreIntent",
  "emotions",
  "values",
  "duality",
  "themes",
  "audienceRelation",
  "influences",
  "visualWorld",
  "identityTraits",
  "freeExpression",
] as const;

export type MessageSignal = (typeof MESSAGE_SIGNALS)[number];

export const messageInputsSchema = z.object({
  coreIntent: z.string().min(1),
  emotions: z.array(z.string().min(1)).min(1),
  values: z.array(z.string().min(1)).min(1),
  duality: z.string().min(1),
  themes: z.array(z.string().min(1)).min(1),
  audienceRelation: z.string().min(1),
  influences: z.array(z.string().min(1)).min(1),
  visualWorld: z.array(z.string().min(1)).min(1),
  identityTraits: z.array(z.string().min(1)).min(1),
  freeExpression: z.string().optional(),
});

export type MessageInputs = z.infer<typeof messageInputsSchema>;

export const messageOutputSchema = z.object({
  title: z.string().min(1),
  narrative: z.string().min(1),
  inspiration: z.string().min(1),
  visualDirection: z.string().min(1),
  authenticity: z.string().min(1),
  aesthetic: z.string().min(1),
});

export type MessageOutput = z.infer<typeof messageOutputSchema>;

export const MESSAGE_SECTION_KEYS = [
  "narrative",
  "inspiration",
  "visualDirection",
  "authenticity",
  "aesthetic",
] as const;

export const messageSectionKeySchema = z.enum(MESSAGE_SECTION_KEYS);

export type MessageSectionKey = (typeof MESSAGE_SECTION_KEYS)[number];

export const messageSectionOutputSchema = z.object({
  content: z.string().min(1),
});

export type MessageSectionOutput = z.infer<typeof messageSectionOutputSchema>;

const questionOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().nullable(),
});

export const messageQuestionSchema = z.object({
  signal: z.enum(MESSAGE_SIGNALS),
  type: z.enum(["single", "multi", "text"]),
  prompt: z.string().min(1),
  options: z.array(questionOptionSchema).nullable(),
  maxSelections: z.number().int().positive().nullable(),
  allowOther: z.boolean(),
});

export type MessageQuestion = z.infer<typeof messageQuestionSchema>;

export const messageQuestionsSchema = z.object({
  questions: z.array(messageQuestionSchema).length(10),
});

export type MessageQuestions = z.infer<typeof messageQuestionsSchema>;
