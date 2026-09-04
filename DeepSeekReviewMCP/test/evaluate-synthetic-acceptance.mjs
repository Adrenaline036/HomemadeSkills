#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!root) throw new Error("Usage: node evaluate-synthetic-acceptance.mjs <acceptance-directory>");
const manifest = read("manifest.json");
const outputNames = ["00-warm-result.json", "01-a-seeded-defect-result.json", "02-b-fixed-clean-result.json", "03-c-adversarial-clean-result.json"];
const results = outputNames.map(read);
const errors = [];

for (const [index, result] of results.entries()) {
  if (result.schema !== "deepseek-readonly-review-result/v3.1") errors.push(`call ${index + 1}: schema mismatch`);
  if (result.provider !== "DeepSeek") errors.push(`call ${index + 1}: provider mismatch`);
  if (result.model !== "deepseek-v4-flash") errors.push(`call ${index + 1}: model mismatch`);
  if (result.finish_reason !== "stop") errors.push(`call ${index + 1}: finish_reason is not stop`);
  if (result.provider_request_count !== 1) errors.push(`call ${index + 1}: provider request count is not one`);
  if (result.implicit_retry_count !== 0) errors.push(`call ${index + 1}: retry count is not zero`);
  if (!result.review_valid) errors.push(`call ${index + 1}: review is invalid (${result.classification})`);
  if (!result.usage || result.usage.prompt_tokens !== result.usage.prompt_cache_hit_tokens + result.usage.prompt_cache_miss_tokens) errors.push(`call ${index + 1}: prompt usage does not close`);
  if (!result.usage || result.usage.total_tokens !== result.usage.prompt_tokens + result.usage.completion_tokens) errors.push(`call ${index + 1}: total usage does not close`);
}

if (results[0]?.classification !== "CACHE_WARMUP_COMPLETE") errors.push("warm-up classification mismatch");
if (results[1]?.classification !== "REVIEW_FINDINGS" || results[1]?.review?.verdict !== "FAIL" || results[1]?.review?.findings?.length !== 1 || results[1]?.review?.unknowns?.length !== 0) errors.push("seeded-defect review did not return exactly one valid finding");
for (const index of [2, 3]) {
  if (results[index]?.classification !== "REVIEW_PASS" || results[index]?.review?.verdict !== "PASS" || results[index]?.review?.findings?.length !== 0 || results[index]?.review?.unknowns?.length !== 0) errors.push(`clean review ${index - 1} did not PASS cleanly`);
}
for (const index of [1, 2, 3]) {
  if (results[index]?.cache_hit_ratio < 0.85 || results[index]?.cache_requirement_met !== true) errors.push(`post-warm call ${index + 1}: cache hit below 85%`);
  if (results[index]?.stable_prefix_sha256 !== manifest.calls[index].stable_prefix_sha256) errors.push(`post-warm call ${index + 1}: stable prefix drift`);
}
const ids = results.map((result) => result.response_id);
if (ids.some((id) => typeof id !== "string" || !id)) errors.push("one or more response IDs are missing");
if (new Set(ids).size !== ids.length) errors.push("response IDs are not unique");

const summary = {
  schema: "deepseek-review-synthetic-acceptance-summary/v3.1",
  passed: errors.length === 0,
  errors,
  request_count: results.reduce((sum, result) => sum + (result.provider_request_count ?? 0), 0),
  retry_count: results.reduce((sum, result) => sum + (result.implicit_retry_count ?? 0), 0),
  response_ids_unique: new Set(ids).size === ids.length,
  stable_prefix_sha256: manifest.calls[1].stable_prefix_sha256,
  calls: results.map((result, index) => ({
    order: index + 1,
    classification: result.classification,
    verdict: result.review?.verdict ?? null,
    findings: result.review?.findings?.length ?? null,
    unknowns: result.review?.unknowns?.length ?? null,
    review_valid: result.review_valid,
    cache_valid: result.cache_valid,
    cache_hit_ratio: result.cache_hit_ratio,
    prompt_tokens: result.usage?.prompt_tokens ?? null,
    cache_hit_tokens: result.usage?.prompt_cache_hit_tokens ?? null,
    cache_miss_tokens: result.usage?.prompt_cache_miss_tokens ?? null,
    completion_tokens: result.usage?.completion_tokens ?? null,
    total_tokens: result.usage?.total_tokens ?? null,
    response_id: result.response_id,
  })),
};
fs.writeFileSync(path.join(root, "acceptance-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (errors.length > 0) process.exitCode = 1;

function read(name) {
  return JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
}
