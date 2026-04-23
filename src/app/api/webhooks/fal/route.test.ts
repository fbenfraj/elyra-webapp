import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock tasks.trigger
const mockTrigger = vi.fn();
vi.mock("@trigger.dev/sdk/v3", () => ({
  tasks: {
    trigger: (...args: unknown[]) => mockTrigger(...args),
  },
}));

// Mock crypto.subtle for signature verification
const mockVerify = vi.fn();
const mockImportKey = vi.fn();

const originalCrypto = globalThis.crypto;

// Valid base64 string for signature (atob won't throw)
const VALID_BASE64_SIG = btoa("test-signature-bytes");

function buildRequest(
  body: Record<string, unknown> | string,
  headers?: Record<string, string>
): NextRequest {
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  return new NextRequest("http://localhost/api/webhooks/fal", {
    method: "POST",
    body: bodyStr,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}

const validPayload = {
  request_id: "req-123",
  session_id: "session-456",
  user_id: "user-789",
  status: "OK" as const,
  payload: {
    images: [{ url: "https://fal.ai/img.webp", content_type: "image/webp" }],
  },
};

describe("POST /api/webhooks/fal", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup crypto.subtle mock
    Object.defineProperty(globalThis, "crypto", {
      value: {
        ...originalCrypto,
        subtle: {
          ...originalCrypto.subtle,
          verify: mockVerify,
          importKey: mockImportKey,
        },
      },
      configurable: true,
    });

    // Mock fetch for JWKS
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            keys: [{ kty: "OKP", crv: "Ed25519", x: "test-key" }],
          }),
      })
    );

    mockImportKey.mockResolvedValue("mock-crypto-key");
  });

  it("returns 401 when signature is invalid", async () => {
    mockVerify.mockResolvedValueOnce(false);

    const request = buildRequest(validPayload, {
      "x-fal-signature": VALID_BASE64_SIG,
    });

    const { POST } = await import(
      "@/app/api/webhooks/fal/route"
    );
    const response = await POST(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Invalid signature");
    expect(mockTrigger).not.toHaveBeenCalled();
  });

  it("returns 401 when signature is missing", async () => {
    mockVerify.mockResolvedValueOnce(false);

    const request = buildRequest(validPayload);

    const { POST } = await import(
      "@/app/api/webhooks/fal/route"
    );
    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(mockTrigger).not.toHaveBeenCalled();
  });

  it("returns 400 when payload is invalid", async () => {
    mockVerify.mockResolvedValueOnce(true);

    const request = buildRequest(
      { invalid: "payload" },
      { "x-fal-signature": VALID_BASE64_SIG }
    );

    const { POST } = await import(
      "@/app/api/webhooks/fal/route"
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid payload");
    expect(mockTrigger).not.toHaveBeenCalled();
  });

  it("returns 200 and dispatches task on valid payload", async () => {
    mockVerify.mockResolvedValueOnce(true);
    mockTrigger.mockResolvedValueOnce({ id: "trigger-run-id" });

    const request = buildRequest(validPayload, {
      "x-fal-signature": VALID_BASE64_SIG,
    });

    const { POST } = await import(
      "@/app/api/webhooks/fal/route"
    );
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);

    expect(mockTrigger).toHaveBeenCalledWith("webhook-process-fal", {
      requestId: "req-123",
      sessionId: "session-456",
      userId: "user-789",
      status: "OK",
      payload: {
        images: [
          { url: "https://fal.ai/img.webp", content_type: "image/webp" },
        ],
      },
      error: undefined,
    });
  });

  it("returns 200 for ERROR status webhooks", async () => {
    mockVerify.mockResolvedValueOnce(true);
    mockTrigger.mockResolvedValueOnce({ id: "trigger-run-id" });

    const errorPayload = {
      ...validPayload,
      status: "ERROR" as const,
      error: "Generation failed",
      payload: undefined,
    };

    const request = buildRequest(errorPayload, {
      "x-fal-signature": VALID_BASE64_SIG,
    });

    const { POST } = await import(
      "@/app/api/webhooks/fal/route"
    );
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockTrigger).toHaveBeenCalledOnce();
  });

  it("returns 500 on unexpected errors", async () => {
    // Mock verify to return true so we pass signature check
    mockVerify.mockResolvedValueOnce(true);

    // Send invalid JSON body — JSON.parse will throw, caught by outer try/catch → 500
    const request = buildRequest("not-json", {
      "x-fal-signature": VALID_BASE64_SIG,
    });

    const { POST } = await import(
      "@/app/api/webhooks/fal/route"
    );
    const response = await POST(request);

    expect(response.status).toBe(500);
  });
});
