import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { tasks } from "@trigger.dev/sdk/v3";
import type { webhookProcessFal } from "@/trigger/webhook-process-fal";

const falWebhookPayloadSchema = z.object({
  request_id: z.string(),
  session_id: z.string(),
  user_id: z.string(),
  status: z.enum(["OK", "ERROR"]),
  payload: z
    .object({
      images: z
        .array(
          z.object({
            url: z.string(),
            content_type: z.string(),
          })
        )
        .optional(),
    })
    .optional(),
  error: z.string().optional(),
});

// JWKS key cache
let cachedJwks: CryptoKey | null = null;
let jwksCachedAt = 0;
const JWKS_TTL_MS = 3_600_000; // 1 hour

async function getJwksKey(): Promise<CryptoKey> {
  if (cachedJwks && Date.now() - jwksCachedAt < JWKS_TTL_MS) {
    return cachedJwks;
  }

  const response = await fetch(
    "https://queue.fal.run/.well-known/jwks.json"
  );
  if (!response.ok) throw new Error("Failed to fetch fal.ai JWKS");

  const jwks = (await response.json()) as {
    keys?: JsonWebKey[];
  };
  const key = jwks.keys?.[0];
  if (!key) throw new Error("No keys in JWKS response");

  cachedJwks = await crypto.subtle.importKey(
    "jwk",
    key,
    { name: "Ed25519" },
    false,
    ["verify"]
  );
  jwksCachedAt = Date.now();
  return cachedJwks;
}

async function verifySignature(
  body: string,
  signature: string
): Promise<boolean> {
  try {
    const key = await getJwksKey();
    const sigBytes = Uint8Array.from(atob(signature), (c) =>
      c.charCodeAt(0)
    );
    const bodyBytes = new TextEncoder().encode(body);
    return await crypto.subtle.verify(
      "Ed25519",
      key,
      sigBytes,
      bodyBytes
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "webhook_signature_verification_failed",
        error: String(error),
      })
    );
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-fal-signature") ?? "";

    // Verify signature
    const isValid = await verifySignature(body, signature);
    if (!isValid) {
      console.warn(
        JSON.stringify({
          event: "webhook_invalid_signature",
          ip: request.headers.get("x-forwarded-for"),
        })
      );
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse payload
    const parsed = falWebhookPayloadSchema.safeParse(JSON.parse(body));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }

    // Dispatch to Trigger.dev task -- fire and forget
    await tasks.trigger<typeof webhookProcessFal>(
      "webhook-process-fal",
      {
        requestId: parsed.data.request_id,
        sessionId: parsed.data.session_id,
        userId: parsed.data.user_id,
        status: parsed.data.status,
        payload: parsed.data.payload,
        error: parsed.data.error,
      }
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "webhook_processing_error",
        error: String(error),
      })
    );
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
