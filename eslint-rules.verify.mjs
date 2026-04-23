/**
 * Verification script for custom ESLint rules.
 *
 * Tests:
 * 1. `import { z } from "zod"` triggers an error (no-restricted-imports)
 * 2. `import { z } from "zod/v4"` passes
 * 3. `.triggerAndWait()` triggers a warning (no-restricted-syntax)
 *
 * Run: node apps/web/eslint-rules.test.mjs
 */

import { ESLint } from "eslint";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const eslint = new ESLint({
  overrideConfigFile: path.join(__dirname, "eslint.config.mjs"),
  cwd: __dirname,
});

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}`);
    failed++;
  }
}

async function lintText(code, filename = "test-file.ts") {
  const results = await eslint.lintText(code, { filePath: filename });
  return results[0].messages;
}

console.log("ESLint rule tests\n");

// Test 1: bare "zod" import should error
console.log("Test 1: Bare zod import triggers error");
const msgs1 = await lintText('import { z } from "zod";\n');
const hasZodError = msgs1.some(
  (m) => m.ruleId === "no-restricted-imports" && m.severity === 2,
);
assert(hasZodError, '"import from zod" triggers no-restricted-imports error');

// Test 2: "zod/v4" import should pass (no restricted-import messages)
console.log("Test 2: zod/v4 import passes");
const msgs2 = await lintText('import { z } from "zod/v4";\n');
const hasZodV4Error = msgs2.some(
  (m) => m.ruleId === "no-restricted-imports",
);
assert(!hasZodV4Error, '"import from zod/v4" does not trigger restriction');

// Test 3: .triggerAndWait() should warn
console.log("Test 3: triggerAndWait triggers warning");
const msgs3 = await lintText(
  'const result = await task.triggerAndWait({ foo: 1 });\n',
);
const hasTriggerWarn = msgs3.some(
  (m) => m.ruleId === "no-restricted-syntax" && m.severity === 1,
);
assert(hasTriggerWarn, ".triggerAndWait() triggers no-restricted-syntax warning");

// Summary
console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
