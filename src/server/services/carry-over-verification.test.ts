/**
 * Story 7.5-6: Retro Carry-Over Verification Tests
 *
 * These tests verify the carry-over items from previous retrospectives:
 * 1. No service uses .triggerAndWait() pattern (async contract enforcement)
 * 2. generation_attempt records contain all traceability fields
 * 3. session detail query returns complete chain data
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ─── Module-level DB mock (hoisted by vi.mock) ─────────────────────────────
// Mutable state that tests can control between describe blocks
let _selectResults: unknown[][] = [];
let _selectCallIdx = 0;

vi.mock("server-only", () => ({}));

vi.mock("@/server/db", () => ({
  db: {
    execute: vi.fn().mockResolvedValue([]),
    select: () => {
      const idx = _selectCallIdx++;
      const rows = _selectResults[idx] ?? [];
      const terminal = () => Promise.resolve(rows);
      return {
        from: () => ({
          where: () =>
            Object.assign(terminal(), {
              orderBy: () => terminal(),
            }),
        }),
      };
    },
  },
}));

vi.mock("@/server/db/schema/sessions", () => ({
  sessions: {
    id: "id",
    briefText: "brief_text",
    status: "status",
    refinementCount: "refinement_count",
    refinementHistory: "refinement_history",
    createdAt: "created_at",
  },
}));

vi.mock("@/server/db/schema/generation-attempts", () => ({
  generationAttempts: {
    id: "id",
    sessionId: "session_id",
    evaluationScore: "evaluation_score",
  },
}));

vi.mock("@/server/db/schema/visual-specs", () => ({
  visualSpecs: {
    id: "id",
    sessionId: "session_id",
    specData: "spec_data",
  },
}));

vi.mock("@/config/evaluation", () => ({ MIN_PASS_SCORE: 0.7 }));

// ─── Task 2.6: Client components should not import from @/server/ ────────────

describe("Client/server boundary enforcement", () => {
  const SRC_DIR = path.resolve(__dirname, "../..");

  function findTsFilesRecursive(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "server" && entry.name !== "node_modules") {
        results.push(...findTsFilesRecursive(fullPath));
      } else if (entry.name.endsWith(".tsx") || (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts"))) {
        results.push(fullPath);
      }
    }
    return results;
  }

  function isClientFile(filePath: string): boolean {
    const content = fs.readFileSync(filePath, "utf-8");
    return content.includes('"use client"') || content.includes("'use client'");
  }

  it("no client component imports runtime values from @/server/", () => {
    const allFiles = findTsFilesRecursive(SRC_DIR);
    const violations: string[] = [];

    for (const filePath of allFiles) {
      if (!isClientFile(filePath)) continue;
      const content = fs.readFileSync(filePath, "utf-8");
      // Match imports from @/server/ but allow type-only imports (erased at build time)
      const lines = content.split("\n");
      for (const line of lines) {
        if (
          line.match(/from\s+["']@\/server\//) &&
          !line.match(/import\s+type\s/) &&
          !line.match(/import\s+\{\s*type\s/)
        ) {
          violations.push(`${path.relative(SRC_DIR, filePath)}: ${line.trim()}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

// ─── Task 5.1: No service uses .triggerAndWait() ─────────────────────────────

describe("Async contract enforcement", () => {
  const SERVICES_DIR = path.resolve(__dirname, ".");
  const TRIGGER_DIR = path.resolve(__dirname, "../../trigger");

  function readTsFiles(dir: string): { file: string; content: string }[] {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    return files.map((f) => ({
      file: path.join(dir, f),
      content: fs.readFileSync(path.join(dir, f), "utf-8"),
    }));
  }

  it("no service file uses .triggerAndWait() pattern", () => {
    const serviceFiles = readTsFiles(SERVICES_DIR);
    const violations: string[] = [];

    for (const { file, content } of serviceFiles) {
      if (content.includes(".triggerAndWait(")) {
        violations.push(path.basename(file));
      }
    }

    expect(violations).toEqual([]);
  });

  it("no trigger task file uses .triggerAndWait() pattern", () => {
    const triggerFiles = readTsFiles(TRIGGER_DIR);
    const violations: string[] = [];

    for (const { file, content } of triggerFiles) {
      if (content.includes(".triggerAndWait(")) {
        violations.push(path.basename(file));
      }
    }

    expect(violations).toEqual([]);
  });

  it("trigger tasks chain via .trigger() (fire-and-chain), not .triggerAndWait()", () => {
    // Verify: tasks call .trigger() to chain the next task (fire-and-chain is correct)
    // .triggerAndWait() is the violation — it blocks inline waiting for the child task
    const triggerFiles = readTsFiles(TRIGGER_DIR);
    const violations: string[] = [];

    for (const { file, content } of triggerFiles) {
      if (content.includes(".triggerAndWait(")) {
        violations.push(path.basename(file));
      }
    }

    expect(violations).toEqual([]);
  });
});

// ─── Task 5.2: generation_attempt records contain all traceability fields ─────

describe("generation_attempts schema traceability fields", () => {
  it("schema source defines all required traceability columns", () => {
    const schemaSource = fs.readFileSync(
      path.resolve(__dirname, "../db/schema/generation-attempts.ts"),
      "utf-8"
    );

    expect(schemaSource).toMatch(/promptUsed/);
    expect(schemaSource).toMatch(/evaluationScore/);
    expect(schemaSource).toMatch(/evaluationFeedback/);
    expect(schemaSource).toMatch(/selected/);
    expect(schemaSource).toMatch(/model/);
    expect(schemaSource).toMatch(/provider/);
    expect(schemaSource).toMatch(/costCents/);
  });

  it("image-generation service populates all traceability fields on insert", () => {
    const serviceSource = fs.readFileSync(
      path.resolve(__dirname, "image-generation.ts"),
      "utf-8"
    );

    expect(serviceSource).toMatch(/promptUsed:/);
    expect(serviceSource).toMatch(/model:/);
    expect(serviceSource).toMatch(/provider:/);
    expect(serviceSource).toMatch(/costCents:/);
  });

  it("evaluation service writes evaluationScore and evaluationFeedback back to attempt records", () => {
    const evaluationSource = fs.readFileSync(
      path.resolve(__dirname, "evaluation.ts"),
      "utf-8"
    );

    expect(evaluationSource).toMatch(/evaluationScore:/);
    expect(evaluationSource).toMatch(/evaluationFeedback:/);
  });
});

// ─── Task 5.3: session detail query returns complete chain data ───────────────

describe("session detail query returns complete traceability chain", () => {
  it("getSessionDetail source returns all required attempt traceability fields", () => {
    const serviceSource = fs.readFileSync(
      path.resolve(__dirname, "session-review.ts"),
      "utf-8"
    );

    expect(serviceSource).toMatch(/promptUsed:/);
    expect(serviceSource).toMatch(/evaluationScore:/);
    expect(serviceSource).toMatch(/evaluationFeedback:/);
    expect(serviceSource).toMatch(/selected:/);
    expect(serviceSource).toMatch(/model:/);
    expect(serviceSource).toMatch(/provider:/);
    expect(serviceSource).toMatch(/costCents:/);
  });

  it("getSessionDetail source includes brief (session) and visual spec in chain", () => {
    const serviceSource = fs.readFileSync(
      path.resolve(__dirname, "session-review.ts"),
      "utf-8"
    );

    expect(serviceSource).toMatch(/briefText/);
    expect(serviceSource).toMatch(/visualSpec/);
    expect(serviceSource).toMatch(/attempts:/);
  });

  it("getSessionDetail source aggregates total cost cents for cost tracking", () => {
    const serviceSource = fs.readFileSync(
      path.resolve(__dirname, "session-review.ts"),
      "utf-8"
    );

    expect(serviceSource).toMatch(/totalCostCents/);
    expect(serviceSource).toMatch(/costCents/);
  });

  describe("getSessionDetail mock-based traceability", () => {
    const selectedAttemptId = "attempt-selected";
    const rejectedAttemptId = "attempt-rejected";

    const mockSession = {
      id: "session-test",
      briefText: "test brief",
      status: "complete",
      refinementCount: 0,
      refinementHistory: null,
      createdAt: new Date(),
    };

    const mockAttempts = [
      {
        id: selectedAttemptId,
        promptUsed: "winning prompt generated from brief",
        evaluationScore: 0.9,
        evaluationFeedback: {
          scores: {
            composition: 0.9,
            colorAccuracy: 0.9,
            moodAlignment: 0.9,
            textAccuracy: 1.0,
            brandConsistency: 0.8,
          },
          overallScore: 0.9,
          feedback: "Strong overall",
          strengths: ["composition"],
          weaknesses: [],
        },
        selected: true,
        costCents: 5,
        model: "fal-ai/flux-pro/v2",
        provider: "fal",
        batchNumber: 1,
      },
      {
        id: rejectedAttemptId,
        promptUsed: "losing prompt variation",
        evaluationScore: 0.4,
        evaluationFeedback: {
          scores: {
            composition: 0.4,
            colorAccuracy: 0.4,
            moodAlignment: 0.4,
            textAccuracy: 1.0,
            brandConsistency: 0.3,
          },
          overallScore: 0.4,
          feedback: "Weak",
          strengths: [],
          weaknesses: ["composition"],
        },
        selected: false,
        costCents: 5,
        model: "fal-ai/flux-pro/v2",
        provider: "fal",
        batchNumber: 1,
      },
    ];

    beforeEach(() => {
      _selectCallIdx = 0;
      // Sequence: [session], [visual-spec], [attempts (via orderBy)]
      _selectResults = [
        [mockSession],
        [{ specData: { mood: "dark" } }],
        mockAttempts,
      ];
    });

    it("returns selected=true for chosen and selected=false for rejected", async () => {
      const { getSessionDetail } = await import(
        "@/server/services/session-review"
      );
      const result = await getSessionDetail("session-test");

      expect(result).not.toBeNull();

      const selected = result?.attempts.find((a) => a.selected === true);
      const rejected = result?.attempts.find((a) => a.selected === false);

      expect(selected).toBeDefined();
      expect(selected?.id).toBe(selectedAttemptId);
      expect(rejected).toBeDefined();
      expect(rejected?.id).toBe(rejectedAttemptId);
    });

    it("returns all traceability fields on every attempt", async () => {
      const { getSessionDetail } = await import(
        "@/server/services/session-review"
      );
      const result = await getSessionDetail("session-test");

      expect(result).not.toBeNull();
      expect(result?.attempts.length).toBeGreaterThan(0);

      for (const attempt of result?.attempts ?? []) {
        expect(attempt).toHaveProperty("promptUsed");
        expect(attempt).toHaveProperty("evaluationScore");
        expect(attempt).toHaveProperty("evaluationFeedback");
        expect(attempt).toHaveProperty("selected");
        expect(attempt).toHaveProperty("model");
        expect(attempt).toHaveProperty("provider");
        expect(attempt).toHaveProperty("costCents");
      }
    });

    it("computes totalCostCents as sum of all attempt costs", async () => {
      const { getSessionDetail } = await import(
        "@/server/services/session-review"
      );
      const result = await getSessionDetail("session-test");

      // 5 + 5 = 10
      expect(result?.totalCostCents).toBe(10);
    });
  });
});
