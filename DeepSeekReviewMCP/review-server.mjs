#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  CACHE_TARGET,
  PREFLIGHT_TARGET,
  RESULT_SCHEMA,
  SERVER_VERSION,
  SYSTEM_CONTRACT_SHA256,
  buildReviewMessages,
  classifyResult,
  safeMessage,
  sha256,
  validateReview,
  validateUsage,
} from "./review-core.mjs";
import { GenerationRegistry, GenerationRegistryError } from "./generation-registry.mjs";

const MODEL = "deepseek-v4-flash";
const API_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_MAX_TOKENS = 8192;
const TIMEOUT_MS = 1_800_000;
const API_KEY = process.env.DEEPSEEK_API_KEY || "";
const generationRegistry = new GenerationRegistry();

const obligationSchema = z.object({
  id: z.string().regex(/^[A-Z][A-Z0-9_-]{2,63}$/),
  clause: z.string().min(8).max(600),
}).strict();

const server = new McpServer({ name: "codex-deepseek-review", version: SERVER_VERSION });

server.registerTool(
  "warm_review_context",
  {
    description: "Preflight and persist one stable DeepSeek review prefix. The first call for a generation makes one Provider request; later calls with the same model and stable-prefix hash return a local reuse result with zero Provider requests. Supply the first planned candidate so size failures occur before billing.",
    inputSchema: z.object({
      stable_context: z.string().min(256).max(3_000_000),
      planned_package_id: z.string().min(1).max(160),
      planned_review_package: z.string().min(1).max(800_000),
      planned_obligations: z.array(obligationSchema).min(1).max(32),
      privacy_screened: z.literal(true),
    }).strict(),
    annotations: { readOnlyHint: true },
  },
  async (input) => warmReviewContext(input),
);

server.registerTool(
  "review_candidate",
  {
    description: "Review one fixed candidate with DeepSeek V4 Flash. Supply task obligations explicitly; fixed general correctness/safety/compatibility/data-integrity/authority obligations are added by the server. One billable Provider request, zero retries.",
    inputSchema: z.object({
      package_id: z.string().min(1).max(160),
      stable_context: z.string().min(256).max(3_000_000),
      review_package: z.string().min(1).max(800_000),
      obligations: z.array(obligationSchema).min(1).max(32),
      privacy_screened: z.literal(true),
      expect_cache_hit: z.boolean().default(true),
      max_tokens: z.number().int().min(512).max(384_000).default(DEFAULT_MAX_TOKENS),
    }).strict(),
    annotations: { readOnlyHint: true },
  },
  async (input) => reviewCandidate(input),
);

await server.connect(new StdioServerTransport());
console.error(`codex-deepseek-review ${SERVER_VERSION} connected via stdio`);

async function executeReview(input) {
  let request;
  try {
    request = buildReviewMessages({
      stableContext: input.stable_context,
      packageId: input.package_id,
      reviewPackage: input.review_package,
      taskObligations: input.obligations,
    });
  } catch (error) {
    return toolFailure("OBLIGATION_PREFLIGHT_FAILED", { message: safeMessage(error), provider_request_count: 0 });
  }

  if (input.review_package !== null && request.predicted_stable_ratio < PREFLIGHT_TARGET) {
    return toolFailure("PREFIX_PREFLIGHT_FAILED", {
      message: `Predicted stable-prefix ratio ${request.predicted_stable_ratio.toFixed(6)} is below ${PREFLIGHT_TARGET}. Reduce or split the dynamic package; do not add irrelevant padding.`,
      stable_prefix_sha256: request.stable_prefix_sha256,
      stable_bytes: request.stable_bytes,
      request_bytes: request.request_bytes,
      predicted_stable_ratio: request.predicted_stable_ratio,
      provider_request_count: 0,
    });
  }
  if (!API_KEY) return toolFailure("CREDENTIAL_UNAVAILABLE", { message: "The launcher did not provide the configured DeepSeek credential.", provider_request_count: 0 });

  const startedAt = new Date();
  let response;
  let payload;
  try {
    response = await fetchOnce(API_KEY, {
      model: MODEL,
      messages: request.messages,
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: input.max_tokens,
      stream: false,
    });
    payload = await response.json();
  } catch (error) {
    return toolFailure("REQUEST_TRANSPORT_FAILED", {
      message: safeMessage(error),
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      stable_prefix_sha256: request.stable_prefix_sha256,
      provider_request_count: 1,
    });
  }
  const finishedAt = new Date();
  if (!response.ok) {
    return toolFailure("PROVIDER_ERROR", {
      message: providerErrorMessage(payload, response.status),
      http_status: response.status,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      stable_prefix_sha256: request.stable_prefix_sha256,
      provider_request_count: 1,
    });
  }

  const choice = Array.isArray(payload?.choices) ? payload.choices[0] : undefined;
  const content = typeof choice?.message?.content === "string" ? choice.message.content : "";
  const finishReason = typeof choice?.finish_reason === "string" ? choice.finish_reason : null;
  const usageResult = validateUsage(payload?.usage);
  const isWarmup = input.review_package === null;
  const parsed = isWarmup
    ? { valid: true, structuralErrors: [], semanticErrors: [], errors: [], value: null }
    : validateReview(content, input.package_id, request.obligations);
  const promptTokens = usageResult.valid ? usageResult.value.prompt_tokens : 0;
  const cacheHitTokens = usageResult.valid ? usageResult.value.prompt_cache_hit_tokens : 0;
  const cacheHitRatio = promptTokens > 0 ? cacheHitTokens / promptTokens : null;
  const cacheRequirementMet = input.expect_cache_hit ? cacheHitRatio !== null && cacheHitRatio >= CACHE_TARGET : null;
  const classification = classifyResult({
    finishReason,
    parsed,
    usageResult,
    isWarmup,
    cacheExpected: input.expect_cache_hit,
    cacheRequirementMet,
  });
  const reviewValid = isWarmup
    ? new Set(["stop", "length"]).has(finishReason) && usageResult.valid
    : finishReason === "stop" && parsed.valid && usageResult.valid;
  const cacheValid = input.expect_cache_hit ? cacheRequirementMet === true : true;
  const structuredContent = {
    schema: RESULT_SCHEMA,
    classification,
    review_valid: reviewValid,
    cache_valid: cacheValid,
    gate_pass: classification === "CACHE_WARMUP_COMPLETE" || classification === "REVIEW_PASS",
    review: !isWarmup && parsed.valid ? parsed.value : null,
    validation_errors: [...usageResult.errors, ...parsed.errors],
    structural_validation_errors: parsed.structuralErrors,
    semantic_validation_errors: parsed.semanticErrors,
    provider: "DeepSeek",
    model: typeof payload?.model === "string" ? payload.model : null,
    response_id: typeof payload?.id === "string" ? payload.id : null,
    system_fingerprint: typeof payload?.system_fingerprint === "string" ? payload.system_fingerprint : null,
    finish_reason: finishReason,
    usage: usageResult.valid ? usageResult.value : null,
    cache_target: CACHE_TARGET,
    cache_hit_ratio: cacheHitRatio,
    cache_expected: input.expect_cache_hit,
    cache_requirement_met: cacheRequirementMet,
    stable_prefix_sha256: request.stable_prefix_sha256,
    stable_bytes: request.stable_bytes,
    request_bytes: request.request_bytes,
    predicted_stable_ratio: request.predicted_stable_ratio,
    response_bytes: Buffer.byteLength(content, "utf8"),
    response_sha256: sha256(content),
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    provider_request_count: 1,
    implicit_retry_count: 0,
  };
  const isError = !reviewValid || !cacheValid;
  return { isError, content: [{ type: "text", text: JSON.stringify(structuredContent) }], structuredContent };
}

async function warmReviewContext(input) {
  let planned;
  let warm;
  try {
    planned = buildReviewMessages({
      stableContext: input.stable_context,
      packageId: input.planned_package_id,
      reviewPackage: input.planned_review_package,
      taskObligations: input.planned_obligations,
    });
    warm = buildReviewMessages({ stableContext: input.stable_context, packageId: "CACHE_WARMUP", reviewPackage: null, taskObligations: [] });
  } catch (error) {
    return toolFailure("OBLIGATION_PREFLIGHT_FAILED", { message: safeMessage(error), provider_request_count: 0 });
  }
  if (planned.predicted_stable_ratio < PREFLIGHT_TARGET) {
    return toolFailure("PREFIX_PREFLIGHT_FAILED", {
      message: `Predicted stable-prefix ratio ${planned.predicted_stable_ratio.toFixed(6)} is below ${PREFLIGHT_TARGET}. Reduce or coherently split the dynamic package; do not pad the stable context.`,
      stable_prefix_sha256: planned.stable_prefix_sha256,
      stable_bytes: planned.stable_bytes,
      request_bytes: planned.request_bytes,
      predicted_stable_ratio: planned.predicted_stable_ratio,
      provider_request_count: 0,
    });
  }

  let reservation;
  try {
    reservation = generationRegistry.reserveWarm({ model: MODEL, stablePrefixSha256: warm.stable_prefix_sha256, systemContractSha256: SYSTEM_CONTRACT_SHA256 });
  } catch (error) {
    return registryFailure(error, { provider_request_count: 0, stable_prefix_sha256: warm.stable_prefix_sha256 });
  }
  if (reservation.action === "reuse") {
    return toolSuccess("CACHE_WARMUP_REUSED", {
      review_valid: true,
      cache_valid: true,
      gate_pass: true,
      provider: "DeepSeek",
      model: MODEL,
      usage: null,
      cache_target: CACHE_TARGET,
      cache_hit_ratio: null,
      cache_expected: false,
      cache_requirement_met: null,
      cache_evidence: "LOCAL_GENERATION_REGISTRY",
      stable_prefix_sha256: warm.stable_prefix_sha256,
      stable_bytes: warm.stable_bytes,
      request_bytes: planned.request_bytes,
      predicted_stable_ratio: planned.predicted_stable_ratio,
      generation: { key: reservation.key, revision: reservation.revision, ...reservation.record },
      provider_request_count: 0,
    });
  }
  if (reservation.action === "in_progress") {
    return toolFailure("CACHE_WARMUP_IN_PROGRESS", {
      message: "Another process owns the warm reservation for this generation.",
      stable_prefix_sha256: warm.stable_prefix_sha256,
      generation: { key: reservation.key, revision: reservation.revision, ...reservation.record },
      provider_request_count: 0,
    });
  }

  const result = await executeReview({
    package_id: "CACHE_WARMUP",
    stable_context: input.stable_context,
    review_package: null,
    obligations: [],
    expect_cache_hit: false,
    max_tokens: 128,
  });
  try {
    let registryResult;
    if (result.structuredContent.classification === "CACHE_WARMUP_COMPLETE" && result.structuredContent.usage) {
      registryResult = generationRegistry.completeWarm({
        key: reservation.key,
        reservationToken: reservation.reservationToken,
        usage: result.structuredContent.usage,
        responseId: result.structuredContent.response_id,
        systemFingerprint: result.structuredContent.system_fingerprint,
      });
    } else {
      registryResult = generationRegistry.failWarm({
        key: reservation.key,
        reservationToken: reservation.reservationToken,
        reason: result.structuredContent.classification,
        providerRequestCount: result.structuredContent.provider_request_count,
      });
    }
    return attachGeneration(result, registryResult);
  } catch (error) {
    return registryFailureAfterProvider(error, result);
  }
}

async function reviewCandidate(input) {
  const result = await executeReview(input);
  if (result.structuredContent.provider_request_count !== 1) return result;
  try {
    const registryResult = generationRegistry.observeReview({
      model: MODEL,
      stablePrefixSha256: result.structuredContent.stable_prefix_sha256,
      systemContractSha256: SYSTEM_CONTRACT_SHA256,
      usage: result.structuredContent.usage,
      cacheRequirementMet: result.structuredContent.cache_requirement_met,
      cacheHitRatio: result.structuredContent.cache_hit_ratio,
      classification: result.structuredContent.classification,
      responseId: result.structuredContent.response_id,
      systemFingerprint: result.structuredContent.system_fingerprint,
    });
    return attachGeneration(result, registryResult);
  } catch (error) {
    return registryFailureAfterProvider(error, result);
  }
}

async function fetchOnce(apiKey, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": `codex-deepseek-review/${SERVER_VERSION}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function toolFailure(classification, details) {
  const structuredContent = { schema: RESULT_SCHEMA, classification, review_valid: false, cache_valid: false, gate_pass: false, implicit_retry_count: 0, ...details };
  return { isError: true, content: [{ type: "text", text: JSON.stringify(structuredContent) }], structuredContent };
}

function toolSuccess(classification, details) {
  const structuredContent = { schema: RESULT_SCHEMA, classification, implicit_retry_count: 0, ...details };
  return { isError: false, content: [{ type: "text", text: JSON.stringify(structuredContent) }], structuredContent };
}

function attachGeneration(result, registryResult) {
  const structuredContent = {
    ...result.structuredContent,
    generation: { key: registryResult.key, revision: registryResult.revision, ...registryResult.record },
  };
  return { ...result, content: [{ type: "text", text: JSON.stringify(structuredContent) }], structuredContent };
}

function registryFailure(error, details) {
  const message = error instanceof GenerationRegistryError ? error.message : safeMessage(error);
  return toolFailure("GENERATION_REGISTRY_INVALID", { message, ...details });
}

function registryFailureAfterProvider(error, result) {
  const message = error instanceof GenerationRegistryError ? error.message : safeMessage(error);
  const structuredContent = { ...result.structuredContent, classification: "GENERATION_REGISTRY_INVALID", gate_pass: false, generation_registry_error: message };
  return { isError: true, content: [{ type: "text", text: JSON.stringify(structuredContent) }], structuredContent };
}

function providerErrorMessage(payload, status) {
  const candidate = payload?.error?.message ?? payload?.message;
  return typeof candidate === "string" && candidate.trim() ? candidate : `DeepSeek API returned HTTP ${status}`;
}
