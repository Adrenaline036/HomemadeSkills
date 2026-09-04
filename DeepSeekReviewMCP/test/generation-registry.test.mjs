import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { GenerationRegistry, GenerationRegistryError, generationKey } from "../generation-registry.mjs";

const MODEL = "deepseek-v4-flash";
const PREFIX = "a".repeat(64);
const CONTRACT = "b".repeat(64);
const WARM_USAGE = { prompt_tokens: 100, prompt_cache_hit_tokens: 0, prompt_cache_miss_tokens: 100, completion_tokens: 4, total_tokens: 104 };
const REVIEW_USAGE = { prompt_tokens: 110, prompt_cache_hit_tokens: 100, prompt_cache_miss_tokens: 10, completion_tokens: 5, total_tokens: 115 };

function fixture() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "deepseek-generation-registry-"));
}

test("one warm reservation is reused across fresh registry instances", (t) => {
  const stateDirectory = fixture();
  t.after(() => fs.rmSync(stateDirectory, { recursive: true, force: true }));
  const first = new GenerationRegistry({ stateDirectory });
  const reservation = first.reserveWarm({ model: MODEL, stablePrefixSha256: PREFIX, systemContractSha256: CONTRACT });
  assert.equal(reservation.action, "reserved");

  const concurrent = new GenerationRegistry({ stateDirectory }).reserveWarm({ model: MODEL, stablePrefixSha256: PREFIX, systemContractSha256: CONTRACT });
  assert.equal(concurrent.action, "in_progress");

  first.completeWarm({ key: reservation.key, reservationToken: reservation.reservationToken, usage: WARM_USAGE, responseId: "warm-1", systemFingerprint: "fp-1" });
  const laterConversation = new GenerationRegistry({ stateDirectory }).reserveWarm({ model: MODEL, stablePrefixSha256: PREFIX, systemContractSha256: CONTRACT });
  assert.equal(laterConversation.action, "reuse");
  assert.equal(laterConversation.record.provider_warm_count, 1);
  assert.equal(laterConversation.record.provider_request_count, 1);
  assert.equal(Object.hasOwn(laterConversation.record, "reservation_token"), false);
});

test("formal reviews accumulate usage and low cache marks a generation stale", (t) => {
  const stateDirectory = fixture();
  t.after(() => fs.rmSync(stateDirectory, { recursive: true, force: true }));
  const registry = new GenerationRegistry({ stateDirectory });
  const reservation = registry.reserveWarm({ model: MODEL, stablePrefixSha256: PREFIX, systemContractSha256: CONTRACT });
  registry.completeWarm({ key: reservation.key, reservationToken: reservation.reservationToken, usage: WARM_USAGE, responseId: "warm-1", systemFingerprint: "fp-1" });
  const confirmed = registry.observeReview({
    model: MODEL,
    stablePrefixSha256: PREFIX,
    systemContractSha256: CONTRACT,
    usage: REVIEW_USAGE,
    cacheRequirementMet: true,
    cacheHitRatio: 100 / 110,
    classification: "REVIEW_PASS",
    responseId: "review-1",
    systemFingerprint: "fp-1",
  });
  assert.equal(confirmed.record.state, "active");
  assert.equal(confirmed.record.formal_review_count, 1);
  assert.equal(confirmed.record.confirmed_review_count, 1);
  assert.equal(confirmed.record.provider_request_count, 2);
  assert.equal(confirmed.record.prompt_tokens, 210);
  assert.equal(confirmed.record.prompt_cache_hit_tokens, 100);
  assert.equal(confirmed.record.aggregate_cache_hit_ratio, 100 / 210);

  const stale = registry.observeReview({
    model: MODEL,
    stablePrefixSha256: PREFIX,
    systemContractSha256: CONTRACT,
    usage: { prompt_tokens: 100, prompt_cache_hit_tokens: 0, prompt_cache_miss_tokens: 100, completion_tokens: 2, total_tokens: 102 },
    cacheRequirementMet: false,
    cacheHitRatio: 0,
    classification: "CACHE_BELOW_TARGET",
    responseId: "review-2",
    systemFingerprint: "fp-1",
  });
  assert.equal(stale.record.state, "stale");
  const nextWarm = registry.reserveWarm({ model: MODEL, stablePrefixSha256: PREFIX, systemContractSha256: CONTRACT });
  assert.equal(nextWarm.action, "reserved");
});

test("registry key binds model and prefix, and corrupt state fails closed", (t) => {
  assert.notEqual(generationKey(MODEL, PREFIX), generationKey("deepseek-v4-pro", PREFIX));
  const stateDirectory = fixture();
  t.after(() => fs.rmSync(stateDirectory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(stateDirectory, "generation-registry.json"), "{not-json", "utf8");
  const registry = new GenerationRegistry({ stateDirectory });
  assert.throws(() => registry.inspect(MODEL, PREFIX), GenerationRegistryError);
  assert.throws(() => registry.reserveWarm({ model: MODEL, stablePrefixSha256: PREFIX, systemContractSha256: CONTRACT }), GenerationRegistryError);
});
