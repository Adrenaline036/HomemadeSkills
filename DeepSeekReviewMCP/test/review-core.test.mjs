import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  CACHE_TARGET,
  FIXED_GENERAL_OBLIGATIONS_CONTEXT,
  GENERAL_OBLIGATIONS,
  buildReviewMessages,
  classifyResult,
  combineObligations,
  validateReview,
  validateUsage,
} from "../review-core.mjs";

const TASK = [{ id: "TASK_PATH_BOUNDARY", clause: "Every resolved target must remain under the declared target root." }];
const allowed = combineObligations(TASK).value;

function pass(packageId = "pkg-pass") {
  return JSON.stringify({ package_id: packageId, verdict: "PASS", findings: [], unknowns: [], summary: "No defect or blocking evidence gap remains." });
}

function finding(overrides = {}) {
  return {
    package_id: "pkg-find",
    verdict: "FAIL",
    findings: [{
      severity: "P1",
      obligation_id: "TASK_PATH_BOUNDARY",
      root_cause_key: "unchecked-parent-segment",
      file: "src/path.js",
      line: 12,
      counterexample: "Input ../outside resolves outside the declared root and reaches the write call.",
      evidence: "resolveTarget joins the input and writes without checking the resolved parent.",
      impact: "A caller can write outside the declared target root.",
      recommendation: "Reject a resolved path unless it is a child of the declared root.",
      ...overrides,
    }],
    unknowns: [],
    summary: "One reachable path-boundary defect remains.",
  };
}

test("stable prefix is byte-identical across dynamic packages", () => {
  const first = buildReviewMessages({ stableContext: "x".repeat(4000), packageId: "a", reviewPackage: "candidate a", taskObligations: TASK });
  const second = buildReviewMessages({ stableContext: "x".repeat(4000), packageId: "b", reviewPackage: "candidate b differs", taskObligations: TASK });
  assert.equal(first.stable_prefix_sha256, second.stable_prefix_sha256);
  assert.deepEqual(first.messages.slice(0, 3), second.messages.slice(0, 3));
  assert.equal(first.messages[1].content, FIXED_GENERAL_OBLIGATIONS_CONTEXT);
  assert.match(first.messages[3].content, /TASK_PATH_BOUNDARY/);
  assert.doesNotMatch(first.messages[3].content, /GENERAL_CORRECTNESS/);
});

test("valid PASS and valid obligation-bound finding are accepted", () => {
  assert.equal(validateReview(pass(), "pkg-pass", allowed).valid, true);
  assert.equal(validateReview(JSON.stringify(finding()), "pkg-find", allowed).valid, true);
});

test("unsupplied obligation is semantic invalid", () => {
  const result = validateReview(JSON.stringify(finding({ obligation_id: "TASK_NEW_POLICY" })), "pkg-find", allowed);
  assert.equal(result.valid, false);
  assert.match(result.semanticErrors.join("\n"), /not supplied/);
});

test("no-defect and search self-talk inside a finding are semantic invalid", () => {
  const result = validateReview(JSON.stringify(finding({ evidence: "The code is correct, so no defect exists. I need to find a real defect." })), "pkg-find", allowed);
  assert.equal(result.valid, false);
  assert.ok(result.semanticErrors.length >= 2);
});

test("duplicate root-cause keys are semantic invalid", () => {
  const value = finding();
  value.findings.push({ ...value.findings[0], file: "tests/path.test.js", line: 8 });
  const result = validateReview(JSON.stringify(value), "pkg-find", allowed);
  assert.equal(result.valid, false);
  assert.match(result.semanticErrors.join("\n"), /duplicates an earlier root cause/);
});

test("detailed evidence accepts realistic findings but rejects oversized fields", () => {
  const realistic = validateReview(JSON.stringify(finding({ evidence: "x".repeat(2400) })), "pkg-find", allowed);
  assert.equal(realistic.valid, true);

  const oversized = validateReview(JSON.stringify(finding({ evidence: "x".repeat(16385) })), "pkg-find", allowed);
  assert.equal(oversized.valid, false);
  assert.match(oversized.structuralErrors.join("\n"), /exceeds 16384/);
});

test("usage accounting must close", () => {
  const good = validateUsage({ prompt_tokens: 100, prompt_cache_hit_tokens: 90, prompt_cache_miss_tokens: 10, completion_tokens: 4, total_tokens: 104 });
  assert.equal(good.valid, true);
  const bad = validateUsage({ prompt_tokens: 100, prompt_cache_hit_tokens: 90, prompt_cache_miss_tokens: 9, completion_tokens: 4, total_tokens: 104 });
  assert.equal(bad.valid, false);
});

test("semantic invalid and cache miss have distinct classifications", () => {
  const usageResult = validateUsage({ prompt_tokens: 100, prompt_cache_hit_tokens: 90, prompt_cache_miss_tokens: 10, completion_tokens: 4, total_tokens: 104 });
  const semantic = validateReview(JSON.stringify(finding({ evidence: "No defect exists, but I need to find one." })), "pkg-find", allowed);
  assert.equal(classifyResult({ finishReason: "stop", parsed: semantic, usageResult, isWarmup: false, cacheExpected: true, cacheRequirementMet: true }), "REVIEW_SEMANTIC_INVALID");
  const clean = validateReview(pass(), "pkg-pass", allowed);
  assert.equal(classifyResult({ finishReason: "stop", parsed: clean, usageResult, isWarmup: false, cacheExpected: true, cacheRequirementMet: false }), "CACHE_BELOW_TARGET");
  assert.equal(CACHE_TARGET, 0.85);
});

test("warm-up classification depends on transport and usage, not generated review JSON", () => {
  const usageResult = validateUsage({ prompt_tokens: 100, prompt_cache_hit_tokens: 0, prompt_cache_miss_tokens: 100, completion_tokens: 4, total_tokens: 104 });
  const deliberatelyUnparsed = { valid: false, structuralErrors: ["warm output is not review evidence"], semanticErrors: [], errors: [], value: null };
  assert.equal(classifyResult({ finishReason: "stop", parsed: deliberatelyUnparsed, usageResult, isWarmup: true, cacheExpected: false, cacheRequirementMet: null }), "CACHE_WARMUP_COMPLETE");
  assert.equal(classifyResult({ finishReason: "length", parsed: deliberatelyUnparsed, usageResult, isWarmup: true, cacheExpected: false, cacheRequirementMet: null }), "CACHE_WARMUP_COMPLETE");
});

test("private BAR v3 bad-response replays are rejected when supplied", () => {
  const fixtureRoot = process.env.DEEPSEEK_REVIEW_BAD_FIXTURES_DIR;
  if (!fixtureRoot) return;
  const request2 = JSON.parse(fs.readFileSync(path.join(fixtureRoot, "review_request2_result.exact.json"), "utf8")).review;
  const request3 = JSON.parse(fs.readFileSync(path.join(fixtureRoot, "review_request3_result.exact.json"), "utf8")).review;
  const result2 = validateReview(JSON.stringify(request2), request2.package_id, allowed);
  const result3 = validateReview(JSON.stringify(request3), request3.package_id, allowed);
  assert.equal(result2.valid, false);
  assert.equal(result3.valid, false);
  assert.match(result3.semanticErrors.join("\n"), /no defect|code is correct|search self-talk/);
});
