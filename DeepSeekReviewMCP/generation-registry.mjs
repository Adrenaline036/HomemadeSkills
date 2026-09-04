import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const GENERATION_REGISTRY_SCHEMA = "deepseek-review-generation-registry/v1";
const LOCK_STALE_MS = 15 * 60 * 1000;
const LOCK_WAIT_MS = 5000;

export class GenerationRegistryError extends Error {
  constructor(message) {
    super(message);
    this.name = "GenerationRegistryError";
  }
}

export function defaultGenerationStateDirectory() {
  const userProfile = process.env.USERPROFILE || os.homedir();
  return process.env.DEEPSEEK_REVIEW_STATE_DIR || path.join(userProfile, ".codex", "mcp-state", "deepseek-review");
}

export function generationKey(model, stablePrefixSha256) {
  if (typeof model !== "string" || !model) throw new GenerationRegistryError("model is required");
  if (!/^[a-f0-9]{64}$/i.test(stablePrefixSha256 ?? "")) throw new GenerationRegistryError("stable prefix SHA-256 is invalid");
  return createHash("sha256").update(`${model}\0${stablePrefixSha256.toLowerCase()}`, "utf8").digest("hex");
}

export class GenerationRegistry {
  constructor({ stateDirectory = defaultGenerationStateDirectory(), now = () => new Date() } = {}) {
    this.stateDirectory = path.resolve(stateDirectory);
    this.registryPath = path.join(this.stateDirectory, "generation-registry.json");
    this.lockPath = path.join(this.stateDirectory, "generation-registry.lock");
    this.now = now;
  }

  inspect(model, stablePrefixSha256) {
    const key = generationKey(model, stablePrefixSha256);
    const state = this.#loadState();
    return { key, record: snapshotRecord(state.generations[key] ?? null), revision: state.revision };
  }

  reserveWarm({ model, stablePrefixSha256, systemContractSha256 }) {
    const key = generationKey(model, stablePrefixSha256);
    return this.#withLockedState((state) => {
      const now = this.now().toISOString();
      const existing = state.generations[key];
      if (existing?.state === "active") {
        return { action: "reuse", key, record: snapshotRecord(existing), revision: state.revision };
      }
      if (existing?.state === "warming" && !reservationIsStale(existing.reserved_at, this.now())) {
        return { action: "in_progress", key, record: snapshotRecord(existing), revision: state.revision };
      }
      const reservationToken = randomUUID();
      state.generations[key] = {
        ...emptyRecord({ model, stablePrefixSha256, systemContractSha256 }),
        ...(existing ?? {}),
        model,
        stable_prefix_sha256: stablePrefixSha256,
        system_contract_sha256: systemContractSha256,
        state: "warming",
        reservation_token: reservationToken,
        reserved_at: now,
        stale_reason: null,
        updated_at: now,
      };
      return { action: "reserved", key, reservationToken, record: snapshotRecord(state.generations[key]) };
    });
  }

  completeWarm({ key, reservationToken, usage, responseId, systemFingerprint }) {
    return this.#withLockedState((state) => {
      const record = requireReservation(state, key, reservationToken);
      const now = this.now().toISOString();
      addUsage(record, usage);
      record.state = "active";
      record.provider_warm_count += 1;
      record.provider_request_count += 1;
      record.last_provider_warm_at = now;
      record.last_response_id = responseId ?? null;
      record.last_system_fingerprint = systemFingerprint ?? null;
      record.stale_reason = null;
      record.reservation_token = null;
      record.reserved_at = null;
      record.updated_at = now;
      return { key, record: snapshotRecord(record) };
    });
  }

  failWarm({ key, reservationToken, reason, providerRequestCount = 0 }) {
    return this.#withLockedState((state) => {
      const record = requireReservation(state, key, reservationToken);
      record.state = "stale";
      record.provider_warm_count += providerRequestCount;
      record.provider_request_count += providerRequestCount;
      record.stale_reason = String(reason || "warm request failed").slice(0, 200);
      record.reservation_token = null;
      record.reserved_at = null;
      record.updated_at = this.now().toISOString();
      return { key, record: snapshotRecord(record) };
    });
  }

  observeReview({ model, stablePrefixSha256, systemContractSha256, usage, cacheRequirementMet, cacheHitRatio, classification, responseId, systemFingerprint }) {
    const key = generationKey(model, stablePrefixSha256);
    return this.#withLockedState((state) => {
      const now = this.now().toISOString();
      const record = state.generations[key] ?? emptyRecord({ model, stablePrefixSha256, systemContractSha256 });
      addUsage(record, usage);
      record.provider_request_count += 1;
      record.formal_review_count += 1;
      record.last_cache_hit_ratio = cacheHitRatio;
      record.last_classification = classification;
      record.last_response_id = responseId ?? null;
      record.last_system_fingerprint = systemFingerprint ?? null;
      if (cacheRequirementMet === true) {
        record.state = "active";
        record.confirmed_review_count += 1;
        record.last_cache_confirmed_at = now;
        record.stale_reason = null;
      } else if (cacheRequirementMet === false) {
        record.state = "stale";
        record.stale_reason = "formal review cache ratio was below target";
      }
      record.reservation_token = null;
      record.reserved_at = null;
      record.updated_at = now;
      state.generations[key] = record;
      return { key, record: snapshotRecord(record) };
    });
  }

  #withLockedState(mutator) {
    fs.mkdirSync(this.stateDirectory, { recursive: true });
    const lock = acquireLock(this.lockPath, this.now);
    let temporaryPath;
    try {
      const state = this.#loadState();
      const result = mutator(state);
      state.revision += 1;
      state.updated_at = this.now().toISOString();
      temporaryPath = `${this.registryPath}.pending-${process.pid}-${randomUUID()}`;
      fs.writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      fs.renameSync(temporaryPath, this.registryPath);
      return { ...result, revision: state.revision };
    } catch (error) {
      if (temporaryPath && fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
      if (error instanceof GenerationRegistryError) throw error;
      throw new GenerationRegistryError(error instanceof Error ? error.message : String(error));
    } finally {
      try { fs.closeSync(lock); } catch {}
      try { fs.rmSync(this.lockPath, { force: true }); } catch {}
    }
  }

  #loadState() {
    if (!fs.existsSync(this.registryPath)) return emptyState(this.now().toISOString());
    let value;
    try {
      value = JSON.parse(fs.readFileSync(this.registryPath, "utf8"));
    } catch (error) {
      throw new GenerationRegistryError(`generation registry is unreadable: ${error instanceof Error ? error.message : String(error)}`);
    }
    validateState(value);
    return value;
  }
}

function emptyState(now) {
  return { schema: GENERATION_REGISTRY_SCHEMA, revision: 0, updated_at: now, generations: {} };
}

function emptyRecord({ model, stablePrefixSha256, systemContractSha256 }) {
  return {
    model,
    stable_prefix_sha256: stablePrefixSha256,
    system_contract_sha256: systemContractSha256,
    state: "stale",
    provider_warm_count: 0,
    provider_request_count: 0,
    formal_review_count: 0,
    confirmed_review_count: 0,
    prompt_tokens: 0,
    prompt_cache_hit_tokens: 0,
    prompt_cache_miss_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    aggregate_cache_hit_ratio: null,
    last_provider_warm_at: null,
    last_cache_confirmed_at: null,
    last_cache_hit_ratio: null,
    last_classification: null,
    last_response_id: null,
    last_system_fingerprint: null,
    stale_reason: null,
    reservation_token: null,
    reserved_at: null,
    updated_at: null,
  };
}

function addUsage(record, usage) {
  if (!usage) return;
  for (const name of ["prompt_tokens", "prompt_cache_hit_tokens", "prompt_cache_miss_tokens", "completion_tokens", "total_tokens"]) {
    const value = usage[name];
    if (!Number.isInteger(value) || value < 0) throw new GenerationRegistryError(`usage.${name} is invalid`);
    record[name] += value;
  }
  record.aggregate_cache_hit_ratio = record.prompt_tokens > 0 ? record.prompt_cache_hit_tokens / record.prompt_tokens : null;
}

function validateState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new GenerationRegistryError("generation registry root must be an object");
  if (value.schema !== GENERATION_REGISTRY_SCHEMA) throw new GenerationRegistryError("generation registry schema is unsupported");
  if (!Number.isInteger(value.revision) || value.revision < 0) throw new GenerationRegistryError("generation registry revision is invalid");
  if (!value.generations || typeof value.generations !== "object" || Array.isArray(value.generations)) throw new GenerationRegistryError("generation registry generations must be an object");
  for (const [key, record] of Object.entries(value.generations)) {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new GenerationRegistryError("generation registry contains an invalid key");
    if (!record || typeof record !== "object" || !new Set(["active", "stale", "warming"]).has(record.state)) throw new GenerationRegistryError(`generation registry record ${key} is invalid`);
  }
}

function requireReservation(state, key, reservationToken) {
  const record = state.generations[key];
  if (!record || record.state !== "warming" || record.reservation_token !== reservationToken) throw new GenerationRegistryError("warm reservation identity changed");
  return record;
}

function reservationIsStale(value, now) {
  const timestamp = Date.parse(value ?? "");
  return !Number.isFinite(timestamp) || now.getTime() - timestamp > LOCK_STALE_MS;
}

function acquireLock(lockPath, now) {
  const started = Date.now();
  while (true) {
    try {
      return fs.openSync(lockPath, "wx", 0o600);
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      try {
        const stat = fs.statSync(lockPath);
        if (now().getTime() - stat.mtimeMs > LOCK_STALE_MS) {
          fs.rmSync(lockPath, { force: true });
          continue;
        }
      } catch (statError) {
        if (statError?.code === "ENOENT") continue;
        throw statError;
      }
      if (Date.now() - started >= LOCK_WAIT_MS) throw new GenerationRegistryError("generation registry is locked by another process");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
}

function snapshotRecord(record) {
  if (!record) return null;
  const { reservation_token: _reservationToken, ...safe } = record;
  return { ...safe };
}
