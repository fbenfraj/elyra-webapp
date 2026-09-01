# Elyra

Visual identity generation for music artists.

An artist writes a short brief — *"dark cinematic trap, nighttime city, moody blue
tones"* — and Elyra turns it into finished release assets. It pulls the artist's
context from Spotify (genres, audio profile, recent releases), proposes three
visual directions with moodboards and colour palettes, generates images against the
chosen direction, scores them with a VLM rubric, and packages the winners at the
exact dimensions Spotify, Apple Music and the social platforms require.

The interesting part is not the image generation. It is everything wrapped around
it: multi-provider routing with health checks and a circuit breaker, per-session and
per-user spend caps, idempotent webhook handling, an evaluation loop that refines its
own prompts when output falls below threshold, and output validated against platform
specs before it is ever handed to a user.

## Running it

```bash
pnpm install
cp .env.example .env          # then fill it in — see Environment below
pnpm exec drizzle-kit migrate # apply the 27 Drizzle migrations
pnpm dev                      # http://localhost:3847
```

The dev server runs on **port 3847**, not 3000.

Supabase provides auth and row-level security. `supabase/migrations/` holds the RLS
and auth-sync policies; they are separate from the Drizzle migrations in
`src/server/db/migrations/`, and both must be applied.

| Command | What it does |
|---|---|
| `pnpm dev` | Next.js dev server on :3847 |
| `pnpm test` | Unit suite (vitest, happy-dom). 56 test files. |
| `pnpm test:watch` | Same, in watch mode |
| `pnpm test:e2e` | Service-level e2e suite, `vitest.e2e.config.mts`. Needs a real database. |
| `pnpm lint` | ESLint, including the custom architectural rules |
| `pnpm build` | Production build |

## Environment

| Group | Vars | Required to |
|---|---|---|
| Database | `DATABASE_URL` | boot |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | boot, sign in |
| Trigger.dev | `TRIGGER_SECRET_KEY` | run any generation |
| fal.ai | `FAL_KEY` | generate images |
| OpenAI | `OPENAI_API_KEY` | interpret briefs, evaluate images |
| Anthropic | `ANTHROPIC_API_KEY` | fallback when OpenAI is unhealthy |
| Cloudflare R2 | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT` | store and serve generated images |
| Stripe | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | take payment |
| App | `NEXT_PUBLIC_APP_URL`, `OPERATOR_USER_IDS` | Stripe redirects, share links, `/operator` access |

`OPERATOR_USER_IDS` is a comma-separated list of Supabase user IDs granted access to
the operator dashboard at `/operator`.

## How a generation runs

The pipeline is a chain of Trigger.dev v4 tasks in `src/trigger/`. Nothing blocks —
tasks fire with `.trigger()` and the client polls session status, a rule the lint
config enforces (see Architecture).

1. **`generation-interpret-brief`** — the free-text brief plus Spotify artist context
   becomes a structured visual spec. `gpt-4.1`, falling back to `gpt-4o`. The brief is
   screened against blocked moderation categories first, before any billable call.
2. **`generation-create-directions`** — three directions, each with a hero image, two
   supporting images, a mood label, tags and a colour palette. The artist picks one.
3. **`generation-refine-prompt`** — builds the image prompt from the chosen direction
   and any reference images. Where references exist, generation is image-conditioned
   through `flux-pro/kontext/multi`, with each reference assigned an explicit role
   (artist identity, visual style, mood and palette).
4. **`generation-create-images`** — four candidates via `flux-pro/v1.1` on fal.ai,
   through `fal.subscribe` inside the task. An asynchronous callback path also exists
   (`/api/webhooks/fal` → `webhook-process-fal`, idempotent on fal's request ID) but is
   not what the current generation path uses; it still references `flux-pro/v2` and the
   v3 SDK import, so treat it as stale.
5. **`generation-evaluate-batch`** — a VLM scores every candidate on a weighted rubric:
   composition (0.25), colour accuracy (0.20), mood alignment (0.20), text accuracy
   (0.20), brand consistency (0.15). Weights can be overridden per genre.
6. **`generation-assemble-package`** — the selected image is resized with `sharp` into
   every platform spec, validated, auto-fixed if it misses a constraint, and zipped
   for download.

**The loop worth noticing is between 5 and 4.** If no candidate clears
`MIN_PASS_SCORE` (0.7), evaluation triggers `generation-refine-prompt` again rather
than failing — the system rewrites its own prompt and regenerates. After
`MAX_EVAL_RETRIES` (3) it degrades gracefully to the best-scoring batch instead of
erroring out. An artist never sees a dead end; they see the best the system managed.

Moodboards run a parallel, shorter path through `moodboard-generate-directions`.

## Architecture

Services own all business logic. Everything else is thin:

```
tRPC routers  ─┐
Trigger tasks ─┼─→ src/server/services/ ─→ src/server/providers/ ─→ external APIs
React (RQ)    ─┘         │
                         └─→ src/server/db/ (Drizzle)
```

- Routers validate with Zod, check auth, delegate. No logic, no direct DB access.
- Tasks call services. Never touch the database or a provider directly.
- Components reach data only through the tRPC client. They never import a service.
- Provider adapters talk to external APIs and nothing else — no DB, no other providers.

Two of those rules are machine-enforced. `eslint.config.mjs` restricts importing `z`
from `zod` (v4 must be imported from `zod/v4`) and warns on any `.triggerAndWait()`
call, because blocking on a Trigger.dev task breaks the async contract the whole
pipeline depends on. `eslint-rules.verify.mjs` is a script that **tests those lint
rules** — it asserts the bad patterns error and the good ones pass, so the guardrails
cannot silently stop working.

## Reliability

The pipeline spends real money on every run, and every stage can fail in a way that
is invisible without instrumentation. What that produced:

- **`provider-routing` / `provider-health` / `provider-executor` / `circuit-breaker`** —
  each stage names a primary and a fallback provider. Failing providers are tripped
  out rather than retried into the ground.
- **`budget`** — `MAX_SESSION_COST_CENTS` (200), `MAX_USER_DAILY_COST_CENTS` (500).
  Per-image costs are known constants, so spend is checked before a call, not
  reconciled after.
- **`idempotency` + `processed_events`** — fal and Stripe webhooks are deduplicated by
  event ID. A replayed webhook cannot double-charge or double-generate.
- **`platform-validation`** with an `autoFix` path — a deliverable that misses its spec
  is corrected, not shipped.
- **`alerts` + `metrics`** — thresholds on hit rate (60%), average cost per deliverable
  (50¢) and provider failure rate (10%). Every stage emits a structured
  `pipeline_stage_complete` line carrying provider, model, outcome, cost and duration.
- **`observability-verification.test.ts`** — asserts the instrumentation itself fires
  correctly. Metrics you have never tested are metrics you cannot trust in an incident.

The operator dashboard at `/operator` reads the resulting `provider_metrics` and
`session_events` tables.

## Testing

56 test files, colocated with what they cover. Unit tests run against happy-dom with
no external services. The e2e suite (`src/**/*.e2e.test.ts`, run separately) exercises
service-level flows such as the full session lifecycle against a real database.

CI runs typecheck, lint and build on every push and PR to `main`. **It does not run
the test suite** — worth fixing before this repo is trusted by anyone else.

## Status

Built April 2026 over an intensive sprint. Feature-complete through the whole flow —
auth, onboarding, brief, directions, moodboards, palettes, generation, evaluation,
packaging, download, share links, Stripe payment, operator dashboard. Not currently
deployed.

One known stale path: the fal webhook route described above still imports the
Trigger.dev v3 SDK and references `flux-pro/v2`. It is unused by the current
generation flow — remove it or bring it up to date before relying on it.
