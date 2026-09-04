#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CACHE_TARGET, PREFLIGHT_TARGET, RESULT_SCHEMA, buildReviewMessages } from "../review-core.mjs";

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--allow-live") throw new Error("Usage: node acceptance/multi-gate-live.mjs --allow-live <new-evidence-directory>");
const outputRoot = path.resolve(args[1]);
if (fs.existsSync(outputRoot)) throw new Error(`Evidence directory already exists: ${outputRoot}`);
fs.mkdirSync(outputRoot, { recursive: true });

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const installedWorker = process.env.CODEX_DEEPSEEK_WORKER || path.join(process.env.USERPROFILE || os.homedir(), ".codex", "mcp", "deepseek-review-worker");
const invokeTool = path.join(installedWorker, "invoke-tool.mjs");
if (!fs.existsSync(invokeTool)) throw new Error(`Installed MCP invocation client is missing: ${invokeTool}`);
const stateDirectory = path.join(outputRoot, "generation-state");
const projectDirectory = path.join(outputRoot, "simulated-project");
fs.mkdirSync(projectDirectory, { recursive: true });

const generationNonce = randomUUID();
const stableContext = buildStableContext(generationNonce);
fs.writeFileSync(path.join(outputRoot, "stable-context.txt"), stableContext, "utf8");
createSimulatedProject(projectDirectory);
const localTests = runSimulatedTests(projectDirectory, outputRoot);
if (localTests.buggy.status !== 1 || localTests.fixed.status !== 0 || localTests.v2.status !== 0) {
  throw new Error(`Simulated project test shape is invalid: ${JSON.stringify(localTests)}`);
}

const gates = buildGates(localTests);
const preflightResults = [];
for (const gate of gates) {
  const preflight = buildReviewMessages({ stableContext, packageId: gate.packageId, reviewPackage: gate.reviewPackage, taskObligations: gate.obligations });
  gate.predictedStableRatio = preflight.predicted_stable_ratio;
  gate.stablePrefixSha256 = preflight.stable_prefix_sha256;
  preflightResults.push({
    package_id: gate.packageId,
    delivery: gate.delivery,
    gate: gate.gate,
    stable_bytes: preflight.stable_bytes,
    request_bytes: preflight.request_bytes,
    dynamic_bytes: preflight.request_bytes - preflight.stable_bytes,
    predicted_stable_ratio: preflight.predicted_stable_ratio,
    target: PREFLIGHT_TARGET,
    pass: preflight.predicted_stable_ratio >= PREFLIGHT_TARGET,
  });
}
fs.writeFileSync(path.join(outputRoot, "preflight-summary.json"), `${JSON.stringify(preflightResults, null, 2)}\n`, "utf8");
const failedPreflight = preflightResults.filter((item) => !item.pass);
if (failedPreflight.length > 0) {
  throw new Error(`Provider was not called because ${failedPreflight.length} package(s) missed the ${PREFLIGHT_TARGET} prefix target; minimum=${Math.min(...preflightResults.map((item) => item.predicted_stable_ratio)).toFixed(6)}`);
}
if (new Set(gates.map((gate) => gate.stablePrefixSha256)).size !== 1) throw new Error("Gate stable-prefix hashes differ");

const calls = [];
let ordinal = 0;
const initialWarm = invoke("warm_review_context", warmInput(gates[0]), `call-${pad(ordinal++)}-conversation-a-cold-warm`);
expect(initialWarm, "CACHE_WARMUP_COMPLETE", 1);
calls.push({ kind: "warm", conversation: "conversation-a", delivery: "v1", gate: "cold-warm", result: initialWarm });

for (const step of [
  { gate: gates[0], conversation: "conversation-a" },
  { rewarm: gates[1], conversation: "conversation-b", delivery: "v1" },
  { gate: gates[1], conversation: "conversation-b" },
  { gate: gates[2], conversation: "conversation-b" },
  { gate: gates[3], conversation: "conversation-b" },
  { rewarm: gates[4], conversation: "conversation-c", delivery: "v1" },
  { gate: gates[4], conversation: "conversation-c" },
  { rewarm: gates[5], conversation: "conversation-d", delivery: "v2" },
  { gate: gates[5], conversation: "conversation-d" },
  { gate: gates[6], conversation: "conversation-d" },
  { rewarm: gates[7], conversation: "conversation-e", delivery: "v2" },
  { gate: gates[7], conversation: "conversation-e" },
  { gate: gates[8], conversation: "conversation-f" },
]) {
  if (step.rewarm) {
    const result = invoke("warm_review_context", warmInput(step.rewarm), `call-${pad(ordinal++)}-${step.conversation}-warm-reuse`);
    expect(result, "CACHE_WARMUP_REUSED", 0);
    calls.push({ kind: "warm-reuse", conversation: step.conversation, delivery: step.delivery, gate: step.rewarm.gate, result });
    continue;
  }
  const gate = step.gate;
  const result = invoke("review_candidate", {
    package_id: gate.packageId,
    stable_context: stableContext,
    review_package: gate.reviewPackage,
    obligations: gate.obligations,
    privacy_screened: true,
    expect_cache_hit: true,
    max_tokens: 2048,
  }, `call-${pad(ordinal++)}-${step.conversation}-${gate.delivery}-${gate.gate}`);
  expect(result, gate.expectedClassification, 1);
  if (result.review_valid !== true || result.cache_valid !== true) throw new Error(`${gate.packageId} is not a valid cached review`);
  if (result.cache_hit_ratio < CACHE_TARGET) throw new Error(`${gate.packageId} cache ratio ${result.cache_hit_ratio} is below ${CACHE_TARGET}`);
  if (gate.expectedClassification === "REVIEW_FINDINGS") {
    if (result.review?.findings?.length !== 1 || result.review.findings[0].obligation_id !== "TASK_ATOMIC_IDEMPOTENCY") throw new Error("Seeded defect was not returned as one obligation-bound finding");
  } else if (result.review?.verdict !== "PASS" || result.review.findings.length !== 0 || result.review.unknowns.length !== 0) {
    throw new Error(`${gate.packageId} did not return a clean PASS`);
  }
  calls.push({ kind: "review", conversation: step.conversation, delivery: gate.delivery, gate: gate.gate, expected: gate.expectedClassification, result });
}

const providerCalls = calls.filter((item) => item.result.provider_request_count === 1);
const reuseCalls = calls.filter((item) => item.kind === "warm-reuse");
const reviews = calls.filter((item) => item.kind === "review");
if (providerCalls.length !== 10) throw new Error(`Expected 10 Provider calls (one warm plus nine reviews), got ${providerCalls.length}`);
if (reuseCalls.length !== 4 || reuseCalls.some((item) => item.result.provider_request_count !== 0)) throw new Error("Warm reuse accounting failed");
if (new Set(providerCalls.map((item) => item.result.response_id)).size !== providerCalls.length) throw new Error("Provider response IDs are not unique");
if (calls.some((item) => item.result.implicit_retry_count !== 0)) throw new Error("An implicit retry was reported");
if (new Set(calls.map((item) => item.result.stable_prefix_sha256)).size !== 1) throw new Error("Runtime stable-prefix hashes differ");

const finalGeneration = reviews.at(-1).result.generation;
if (finalGeneration.provider_warm_count !== 1) throw new Error(`Expected one Provider warm, got ${finalGeneration.provider_warm_count}`);
if (finalGeneration.formal_review_count !== 9 || finalGeneration.confirmed_review_count !== 9) throw new Error("Generation review counters do not cover all formal gates");
if (finalGeneration.provider_request_count !== 10) throw new Error("Generation Provider request count is incorrect");
if (finalGeneration.aggregate_cache_hit_ratio < CACHE_TARGET) throw new Error(`Amortized generation cache ratio ${finalGeneration.aggregate_cache_hit_ratio} is below ${CACHE_TARGET}`);

const summary = {
  schema: "deepseek-review-multi-gate-acceptance/v1",
  adapter_schema: RESULT_SCHEMA,
  result: "PASS",
  model: "deepseek-v4-flash",
  stable_prefix_sha256: finalGeneration.stable_prefix_sha256,
  system_contract_sha256: finalGeneration.system_contract_sha256,
  stable_context_bytes: Buffer.byteLength(stableContext, "utf8"),
  cold_warm_provider_requests: finalGeneration.provider_warm_count,
  local_warm_reuse_calls: reuseCalls.length,
  formal_review_provider_requests: finalGeneration.formal_review_count,
  total_provider_requests: finalGeneration.provider_request_count,
  implicit_retries: 0,
  conversations: [...new Set(calls.map((item) => item.conversation))],
  deliveries: [...new Set(calls.map((item) => item.delivery).filter(Boolean))],
  gates: reviews.map((item) => ({
    conversation: item.conversation,
    delivery: item.delivery,
    gate: item.gate,
    classification: item.result.classification,
    cache_hit_ratio: item.result.cache_hit_ratio,
    response_id: item.result.response_id,
    prompt_tokens: item.result.usage.prompt_tokens,
    prompt_cache_hit_tokens: item.result.usage.prompt_cache_hit_tokens,
    prompt_cache_miss_tokens: item.result.usage.prompt_cache_miss_tokens,
  })),
  generation_usage: {
    prompt_tokens: finalGeneration.prompt_tokens,
    prompt_cache_hit_tokens: finalGeneration.prompt_cache_hit_tokens,
    prompt_cache_miss_tokens: finalGeneration.prompt_cache_miss_tokens,
    completion_tokens: finalGeneration.completion_tokens,
    total_tokens: finalGeneration.total_tokens,
    aggregate_cache_hit_ratio: finalGeneration.aggregate_cache_hit_ratio,
  },
  local_tests: localTests,
};
fs.writeFileSync(path.join(outputRoot, "acceptance-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(outputRoot, "verification-summary.md"), renderMarkdown(summary), "utf8");
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

function invoke(toolName, input, stem) {
  const inputPath = path.join(outputRoot, `${stem}.input.json`);
  const outputPath = path.join(outputRoot, `${stem}.result.json`);
  fs.writeFileSync(inputPath, `${JSON.stringify(input, null, 2)}\n`, "utf8");
  const completed = spawnSync(process.execPath, [invokeTool, toolName, inputPath, outputPath], {
    cwd: installedWorker,
    env: { ...process.env, DEEPSEEK_REVIEW_STATE_DIR: stateDirectory },
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
  fs.writeFileSync(path.join(outputRoot, `${stem}.process.json`), `${JSON.stringify({ status: completed.status, signal: completed.signal, stdout: completed.stdout, stderr: completed.stderr }, null, 2)}\n`, "utf8");
  if (!fs.existsSync(outputPath)) throw new Error(`${stem} produced no result; exit ${completed.status}`);
  const result = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  if (completed.status !== 0) throw new Error(`${stem} failed with exit ${completed.status}: ${result.classification}`);
  return result;
}

function expect(result, classification, providerRequestCount) {
  if (result.schema !== RESULT_SCHEMA) throw new Error(`Unexpected adapter schema ${result.schema}`);
  if (result.classification !== classification) throw new Error(`Expected ${classification}, got ${result.classification}`);
  if (result.provider_request_count !== providerRequestCount) throw new Error(`Expected Provider count ${providerRequestCount}, got ${result.provider_request_count}`);
}

function warmInput(gate) {
  return {
    stable_context: stableContext,
    planned_package_id: gate.packageId,
    planned_review_package: gate.reviewPackage,
    planned_obligations: gate.obligations,
    privacy_screened: true,
  };
}

function buildGates(localTests) {
  const obligation = (id, clause) => [{ id, clause }];
  return [
    {
      delivery: "v1", gate: "phase0", packageId: "SIM-V1-PHASE0",
      obligations: obligation("TASK_PHASE0_DESIGN", "The proposed reservation design must define one atomic idempotency authority, audit ordering, restart behavior, and rollback without alternate writers."),
      expectedClassification: "REVIEW_PASS",
      reviewPackage: `Gate: Phase 0 architecture. Candidate design: ReservationStore.reserve(key,payload) owns the only mutation transaction. It acquires the per-key lock, rechecks the durable key inside the lock, writes one immutable reservation, appends one audit event in the same transaction, commits, then returns the stored value. Existing keys return the stored value without another audit event. A journal record makes interrupted commits either fully replayable or absent. API and recovery modules can call ReservationStore but cannot write the tables. No implementation is claimed at this gate. Evidence: producer/consumer inventory lists API, scheduler, recovery and migration; alternate writers=0; rollback restores the prior transaction and journal version.`,
    },
    {
      delivery: "v1", gate: "red", packageId: "SIM-V1-RED",
      obligations: obligation("TASK_RED_VALIDITY", "The RED artifact must deterministically expose duplicate creation under concurrent same-key calls while keeping production unchanged and retaining passing controls."),
      expectedClassification: "REVIEW_PASS",
      reviewPackage: `Gate: incident RED. The candidate under review is the test artifact, not a product fix. Two calls reserve("alpha") enter the pre-write barrier before either writes; assertions require one ID and one audit event. Against the frozen buggy implementation the test exits 1 with two IDs and two events; single-call and different-key controls pass. Production files are unchanged. Actual local result: exit ${localTests.buggy.status}; failure text confirms duplicate IDs/events. This is the intended incident-shaped RED and explicitly leaves GREEN open.`,
    },
    {
      delivery: "v1", gate: "green-buggy", packageId: "SIM-V1-GREEN-BUGGY",
      obligations: obligation("TASK_ATOMIC_IDEMPOTENCY", "Concurrent calls using the same idempotency key must return one reservation and emit exactly one durable audit event."),
      expectedClassification: "REVIEW_FINDINGS",
      reviewPackage: `Gate: first GREEN candidate. Implementation:\nasync reserve(key,payload){ if(this.rows.has(key)) return this.rows.get(key); await this.barrier(); const value={id:++this.nextId,key,payload}; this.rows.set(key,value); this.audit.push({type:"created",id:value.id}); return value; }\nThe barrier releases two same-key calls together. Test observation: returned IDs are 1 and 2 and audit length is 2. Determine whether this satisfies atomic same-key idempotency.`,
    },
    {
      delivery: "v1", gate: "green-fixed", packageId: "SIM-V1-GREEN-FIXED",
      obligations: obligation("TASK_ATOMIC_IDEMPOTENCY", "Concurrent calls using the same idempotency key must return one reservation and emit exactly one durable audit event."),
      expectedClassification: "REVIEW_PASS",
      reviewPackage: `Gate: corrected GREEN. Implementation uses a per-key inFlight Promise installed synchronously before awaiting work; every concurrent caller returns that Promise. The owner rechecks durable rows, creates one record and one audit event, then removes only its own Promise in finally. Different keys use distinct Promises. Local tests: buggy RED remains incident-shaped; corrected suite exit ${localTests.fixed.status}, six assertions pass including 32 concurrent same-key calls, different-key independence and injected failure cleanup. No alternate writer exists.`,
    },
    {
      delivery: "v1", gate: "final", packageId: "SIM-V1-FINAL",
      obligations: obligation("TASK_V1_FINAL", "The fixed v1 delivery must close the concurrency incident, preserve audit and restart invariants, and remain an unstaged local candidate."),
      expectedClassification: "REVIEW_PASS",
      reviewPackage: `Gate: v1 final. Fixed candidate identity SIM-V1-FIXED-01. Phase0 design, incident RED and corrected GREEN are frozen. Required tests exit 0; 32-way same-key concurrency yields one immutable ID and one created event; retry returns the same value; injected failure clears inFlight without a row/event; reconstructed service returns the durable row without duplication. Static checks pass, privacy screen pass, stage/commit/deploy not run. All prior seeded finding evidence points to the replaced implementation and is dispositioned fixed.`,
    },
    {
      delivery: "v2", gate: "phase0", packageId: "SIM-V2-PHASE0",
      obligations: obligation("TASK_V2_DESIGN", "The v2 cancellation design must preserve the v1 reservation authority and define idempotent cancellation without deleting audit history."),
      expectedClassification: "REVIEW_PASS",
      reviewPackage: `Delivery v2, Phase 0. Add cancel(key,expectedRevision) to the existing sole ReservationStore writer. Under the same per-key lock it rejects stale revisions, returns the existing cancelled record on repeat calls, changes active to cancelled exactly once, and appends one cancellation event without deleting the creation event. Reserve on a cancelled key returns the terminal record. API and recovery remain read-only adapters to this authority. Rollback ignores the new command and preserves v1 records.`,
    },
    {
      delivery: "v2", gate: "red", packageId: "SIM-V2-RED",
      obligations: obligation("TASK_V2_RED", "The v2 RED artifact must expose non-idempotent repeated cancellation while retaining all v1 concurrency controls."),
      expectedClassification: "REVIEW_PASS",
      reviewPackage: `Delivery v2, RED gate. Test creates one reservation, calls cancel twice at the same accepted revision, and requires one terminal record plus one cancellation event while retaining the creation event. The pre-v2 implementation lacks cancel and fails at the exact missing method; all v1 fixed tests still pass. Production is unchanged at RED. This is expected failing evidence, not a claim that v2 is implemented.`,
    },
    {
      delivery: "v2", gate: "green", packageId: "SIM-V2-GREEN",
      obligations: obligation("TASK_V2_GREEN", "The implemented cancellation command must be revision-checked, idempotent, append-only in audit history, and preserve v1 concurrency behavior."),
      expectedClassification: "REVIEW_PASS",
      reviewPackage: `Delivery v2, GREEN. cancel executes inside the same keyed authority as reserve. Active revision 1 becomes cancelled revision 2 and appends cancellation once; another cancel returns revision 2 without writing. A stale expected revision is rejected before mutation. Creation audit remains. Reconstructed state preserves terminal status. Local v2 suite exit ${localTests.v2.status}; v1 corrected suite remains exit ${localTests.fixed.status}. Writer inventory still reports ReservationStore only.`,
    },
    {
      delivery: "v2", gate: "final", packageId: "SIM-V2-FINAL",
      obligations: obligation("TASK_V2_FINAL", "The complete v2 delivery must preserve all v1 guarantees, close cancellation RED, and keep publication and runtime boundaries unchanged."),
      expectedClassification: "REVIEW_PASS",
      reviewPackage: `Delivery v2 final. Candidate SIM-V2-FIXED-01 includes only the typed cancel command and tests. v1 concurrency/idempotency/restart controls pass; v2 stale, repeated, audit-history and restart tests pass. Source inventory has one writer; no credential, network, runtime, database, Git publication or deployment action occurred. The delivery remains an unstaged local synthetic candidate and all supplied obligations have direct test evidence.`,
    },
  ];
}

function buildStableContext(nonce) {
  const states = ["missing", "active", "cancelled", "recovered"];
  const operations = ["reserve", "lookup", "cancel", "recover"];
  const matrix = [];
  for (const state of states) {
    for (const operation of operations) {
      matrix.push(`- ${state}/${operation}: all reads use the immutable key; only ReservationStore may mutate; revision checks occur inside the keyed transaction; audit history is append-only; a repeated accepted command returns the canonical stored result; errors leave no partial row, event, lock, or alternate recovery writer.`);
    }
  }
  const proofCatalog = [
    "same-key reserve race: release 2, 8 and 32 callers from one pre-commit barrier; all callers must observe one ID and the store must contain one creation event",
    "different-key progress: block one key before commit while a second key completes, proving authority is keyed rather than one hidden global serialization point",
    "pre-commit exception: inject failure after ID planning but before durable commit; row, audit event, journal commit marker and in-flight owner must all remain absent",
    "post-commit observation failure: fail only the response adapter after commit; lookup and retry expose the committed row without allocating another ID or event",
    "process restart after commit: reconstruct from the committed journal and retry reserve; the original immutable value and creation audit identity are returned",
    "process restart before commit: reconstruct from a journal lacking the commit marker; neither an orphan row nor an audit event is materialized",
    "normalization collision: equivalent accepted spellings normalize before lock selection and converge on one authority; rejected spellings never reach mutation code",
    "payload disagreement: the first committed payload remains canonical; a later same-key request cannot overwrite it and follows the fixed interface contract",
    "audit ordering: created precedes every later terminal event, sequence numbers are monotonic, and read adapters cannot synthesize missing history",
    "audit durability: cancellation and recovery never delete, rewrite or renumber creation; snapshot and restart expose the same ordered event identities",
    "cancel race: concurrent accepted cancellation commands share reservation authority and converge on revision 2 plus exactly one cancellation event",
    "stale cancellation: a mismatched expected revision is rejected inside the transaction before status, revision, journal or audit mutation",
    "repeated cancellation: once terminal, another cancel reads the terminal result and cannot append an event even if it carries the earlier accepted revision",
    "reserve after cancellation: reserve returns the terminal record and cannot reactivate, replace or allocate another reservation for the immutable key",
    "lookup absence: reading a missing key returns absence without acquiring mutation authority, reserving an ID, repairing a journal or adding an event",
    "snapshot determinism: state and audit views use declared stable sorting so two reads of identical durable state have byte-identical evidence",
    "writer inventory: mutation primitives are imported only by reservation-store.mjs; API, scheduler, UI, migration and recovery expose no alternate writer",
    "test integrity: RED and GREEN retain the same assertions and barrier; GREEN cannot skip, weaken, retry or special-case fixture identities",
    "compatibility: adding cancel does not alter reserve, lookup, auditFor, recovery or v1 record encoding; older active records remain readable",
    "rollback: disabling the v2 command leaves v1 rows and histories readable and performs no destructive rewrite or silent cancellation acceptance",
    "privacy: fixtures contain generated local values only and exclude credentials, user paths, private history, production records and Provider secrets",
    "external boundary: acceptance starts no service, opens no listener, changes no database, stages no Git state, publishes nothing and touches no NAS/media",
    "evidence identity: every gate binds its package ID, obligation, candidate and local result; a later candidate cannot inherit an earlier candidate's proof",
    "review semantics: findings name allowed obligations and reachable counterexamples; missing proof is unknown, and PASS requires both arrays empty",
    "baseline freeze: source inventory, public interfaces, test assertions and authority map are captured before RED; every later comparison names that same frozen baseline",
    "candidate isolation: only one candidate identity is reviewed per package; uncommitted alternatives, abandoned patches and future plans cannot count as evidence",
    "finding disposition: a corrected gate names the replaced behavior and reruns the exact counterexample; merely explaining or suppressing a finding does not close it",
    "unknown disposition: absent evidence remains blocking until a later fixed candidate supplies it; assumptions and prior conversation summaries cannot substitute for proof",
    "restart identity: durable row, revision, event order and journal commit identity are compared before and after reconstruction rather than inferred from one process",
    "release boundary: a review PASS authorizes only the declared local gate; staging, commit, publication, deployment and user acceptance remain distinct decisions",
  ];
  const schemaCatalog = [
    "ReservationKey is normalized exactly once at the public boundary, remains an opaque string afterward, and is the sole key used by row, lock, journal and audit indexes",
    "ReservationRow requires id, normalized key, immutable payload digest, status, revision, created sequence and last transition sequence; optional fields cannot redefine identity",
    "status is a closed set of active and cancelled for these deliveries; recovery cannot introduce an intermediate value that ordinary commands silently treat as active",
    "revision begins at one on creation and increments only with a committed state transition; reads, repeats, failures and rejected stale commands never advance it",
    "JournalEntry carries transaction identity, normalized key, before revision, after revision, row digest, ordered event digests and a final commit marker",
    "a journal entry without its final commit marker is ignored as a unit; recovery cannot replay selected row or audit fragments from an incomplete transaction",
    "AuditEvent carries stable event identity, key, reservation ID, type, resulting revision and monotonic sequence; it contains no mutable response or adapter state",
    "CreatedEvent is emitted in the same transaction as revision one and is unique for a reservation ID; a duplicate ID or duplicate event is a correctness failure",
    "CancelledEvent is emitted in the same transaction as revision two and never replaces CreatedEvent; repeated cancellation returns state without emitting an event",
    "CommandResult is derived from committed ReservationRow and contains no separate success flag that could disagree with durable state after restart",
    "inFlight is process-local coordination only, indexed by normalized key and Promise identity; it is never persisted, exposed as domain state or reused across keys",
    "finally removes an in-flight entry only when the map still contains the same Promise identity, preventing an old owner from deleting a newer generation",
    "ID allocation occurs inside the owning transaction after the durable duplicate check; an abandoned attempt cannot consume an observable reservation identity",
    "payload digest comparison occurs before returning an existing active row when the interface requires conflict rejection; no path mutates the stored payload in place",
    "lookup returns a defensive immutable view and cannot expose internal maps, audit arrays, journal buffers, lock handles or mutation functions to an adapter",
    "auditFor returns a new ordered read-only sequence and cannot let a caller append, splice, reorder or rewrite the store's canonical history",
    "snapshot serializes records by normalized key and events by sequence with explicit schema version, allowing byte comparison across restart and rollback evidence",
    "recovery validates journal schema, transaction digest, commit marker and monotonic revision before asking ReservationStore to accept a replayed transaction",
    "migration may translate an older record only through a declared version adapter before authority acquisition; it cannot write current rows or audit history directly",
    "API maps command conflicts and stale revisions to typed outcomes after store completion; transport cancellation cannot cancel or repeat an already committed transaction",
    "scheduler uses caller-supplied idempotency keys and consumes canonical results; it has no fallback key generator or direct repair branch when a command is slow",
    "UI receives read-only DTOs and can request commands through API only; display refresh, optimistic state and retry controls never become durable authority",
    "test hooks are dependency-injected barriers or failure points with no production default behavior, and production code contains no branch on fixture name or test mode",
    "error taxonomy separates validation, conflict, stale revision, injected pre-commit failure, recovery corruption and adapter observation failure without catch-all success",
    "logging records transaction and event identities after privacy screening but never the payload body, credential, absolute workstation path or raw Provider request",
    "metrics distinguish attempted commands, committed transitions, idempotent reads, rejected stale calls and recovery replay; counters cannot be used as correctness proof",
    "serialization encodes all schema versions explicitly and rejects unknown mandatory fields; it does not guess a version from missing properties or file location",
    "compatibility tests load representative v1 snapshots through the v2 reader and compare canonical reserve, lookup, audit and recovery outcomes before enabling cancel",
    "authority tests inspect the module dependency graph as well as runtime behavior, because a dormant alternate writer remains a future bypass even when not exercised",
    "final evidence records test command, exit status, fixed candidate digest and unchanged external boundaries; summaries alone are not accepted as proof of execution",
  ];
  return `# Stable project context: LedgerBox reservation service\n\nTest-only generation nonce: ${nonce}. This value is fixed for the whole acceptance run and exists only to prove one new cold generation. It never changes between review gates, delivery versions, conversations, or MCP processes.\n\n## Authority and safety contract\n\nLedgerBox is a small local library that turns an idempotency key into one immutable reservation. ReservationStore is the sole writer for reservation rows, keyed command state, revisions, journal entries and audit events. HTTP, scheduler, recovery, migration and UI layers are adapters and may not write those structures. All commands are local and deterministic. There is no network, credential, account, deployment, production database, Git publication or destructive external action in this simulated project.\n\nEvery mutation acquires authority by exact normalized key, rechecks state inside the authority, writes row and audit event in one transaction, then publishes the result. A process interruption before commit exposes neither; after commit recovery returns the same row. Audit is append-only. IDs are monotonically allocated by the store transaction. Concurrent same-key calls must converge on one result. Different keys may proceed independently. Locks and in-flight markers are always released after success or failure.\n\n## Stable public interfaces\n\n- reserve(key, payload): returns an immutable {id,key,payload,status,revision}; existing or terminal keys return their stored value.\n- lookup(key): read-only exact-key lookup; never creates or repairs state.\n- cancel(key, expectedRevision): optional versioned command added only by a delivery; it must share the ReservationStore authority.\n- recover(journal): replays committed transactions only and cannot invent a second writer.\n- auditFor(key): ordered read-only events; creation cannot be deleted by later commands.\n- snapshot(): deterministic sorted state used only by tests and evidence.\n\n## Stable module boundaries\n\nkey-policy.mjs trims and validates keys, rejects separators/control characters and never assigns IDs. transaction.mjs provides keyed mutual exclusion, compare-and-swap revision checks and commit/rollback. reservation-store.mjs is the only module importing transaction mutation primitives. audit-view.mjs and api.mjs receive read-only facades. recovery.mjs can ask ReservationStore to replay a committed journal entry but cannot write rows directly. Tests may inject barriers and failures through declared hooks; production modules do not inspect test names or fixture IDs.\n\n## Stable acceptance semantics\n\nPhase 0 reviews architecture and authority before implementation. RED must fail for the intended reachable incident while controls pass and production remains unchanged. GREEN must make the same RED pass through the canonical implementation without weakening assertions, skipping, retry loops, alternate writers or fixture hardcoding. Final review binds the fixed candidate, full tests, privacy and external-state boundaries. A later delivery may add an operation but must retain every accepted earlier invariant. Reviewer findings are evidence only and must identify a supplied obligation plus a concrete reachable counterexample. PASS is expected when no supplied defect remains.\n\n## Stable compatibility matrix\n\n${matrix.join("\n")}\n\n## Stable incident and proof catalog\n\n${proofCatalog.map((item, index) => `- P${String(index + 1).padStart(2, "0")}: ${item}.`).join("\n")}\n\n## Stable data and module schema catalog\n\n${schemaCatalog.map((item, index) => `- S${String(index + 1).padStart(2, "0")}: ${item}.`).join("\n")}\n\n## Stable test oracle\n\nThe canonical concurrency oracle releases all same-key calls only after each has reached the declared pre-commit hook. It then asserts object identity by ID, one durable row, one creation event, no residual in-flight marker and deterministic restart lookup. Failure injection occurs before commit and asserts zero row/event plus a reusable key. Cancellation tests retain creation history, reject stale revisions before mutation, allow exactly one terminal transition and treat repeat calls as reads of the terminal result. Test outputs, candidate hashes, delivery labels and review dispositions are dynamic evidence and are intentionally absent from this stable contract.\n`;
}

function createSimulatedProject(root) {
  fs.writeFileSync(path.join(root, "buggy.mjs"), `export async function duplicateIds(){let next=0;const rows=new Map();const audit=[];const barrier=()=>new Promise(r=>setImmediate(r));async function reserve(key){if(rows.has(key))return rows.get(key);await barrier();const row={id:++next,key};rows.set(key,row);audit.push(row.id);return row;}const values=await Promise.all([reserve("alpha"),reserve("alpha")]);return {ids:values.map(v=>v.id),events:audit.length};}\n`, "utf8");
  fs.writeFileSync(path.join(root, "fixed.mjs"), `export async function oneId(){let next=0;const rows=new Map();const audit=[];const inFlight=new Map();async function reserve(key){if(rows.has(key))return rows.get(key);if(inFlight.has(key))return inFlight.get(key);const work=(async()=>{await new Promise(r=>setImmediate(r));if(rows.has(key))return rows.get(key);const row={id:++next,key,status:"active",revision:1};rows.set(key,row);audit.push({type:"created",id:row.id});return row;})();inFlight.set(key,work);try{return await work;}finally{if(inFlight.get(key)===work)inFlight.delete(key);}}const values=await Promise.all(Array.from({length:32},()=>reserve("alpha")));return {ids:[...new Set(values.map(v=>v.id))],events:audit.length,residual:inFlight.size};}\n`, "utf8");
  fs.writeFileSync(path.join(root, "v2.mjs"), `export function cancelTwice(){const audit=[{type:"created",revision:1}];let row={id:1,key:"alpha",status:"active",revision:1};function cancel(expected){if(row.status==="cancelled")return row;if(row.revision!==expected)throw new Error("stale revision");row={...row,status:"cancelled",revision:2};audit.push({type:"cancelled",revision:2});return row;}const first=cancel(1);const second=cancel(1);return {first,second,audit};}\n`, "utf8");
  fs.writeFileSync(path.join(root, "buggy.test.mjs"), `import assert from "node:assert/strict";import test from "node:test";import {duplicateIds} from "./buggy.mjs";test("same key is atomic",async()=>{const r=await duplicateIds();assert.deepEqual(r.ids,[1,1]);assert.equal(r.events,1);});\n`, "utf8");
  fs.writeFileSync(path.join(root, "fixed.test.mjs"), `import assert from "node:assert/strict";import test from "node:test";import {oneId} from "./fixed.mjs";test("32 calls converge",async()=>{const r=await oneId();assert.deepEqual(r.ids,[1]);assert.equal(r.events,1);assert.equal(r.residual,0);});\n`, "utf8");
  fs.writeFileSync(path.join(root, "v2.test.mjs"), `import assert from "node:assert/strict";import test from "node:test";import {cancelTwice} from "./v2.mjs";test("cancel is idempotent and append-only",()=>{const r=cancelTwice();assert.equal(r.first.revision,2);assert.equal(r.second.revision,2);assert.equal(r.audit.filter(e=>e.type==="created").length,1);assert.equal(r.audit.filter(e=>e.type==="cancelled").length,1);});\n`, "utf8");
}

function runSimulatedTests(root, evidenceRoot) {
  const result = {};
  for (const name of ["buggy", "fixed", "v2"]) {
    const completed = spawnSync(process.execPath, ["--test", path.join(root, `${name}.test.mjs`)], { encoding: "utf8", windowsHide: true });
    result[name] = { status: completed.status, stdout: completed.stdout, stderr: completed.stderr };
    fs.writeFileSync(path.join(evidenceRoot, `local-test-${name}.json`), `${JSON.stringify(result[name], null, 2)}\n`, "utf8");
  }
  return result;
}

function renderMarkdown(summary) {
  const rows = summary.gates.map((gate) => `| ${gate.conversation} | ${gate.delivery} | ${gate.gate} | ${gate.classification} | ${(gate.cache_hit_ratio * 100).toFixed(4)}% | ${gate.prompt_tokens}=${gate.prompt_cache_hit_tokens}+${gate.prompt_cache_miss_tokens} |`).join("\n");
  return `# Multi-gate cross-conversation cache acceptance\n\n- Result: **${summary.result}**\n- Stable prefix: \`${summary.stable_prefix_sha256}\`\n- Conversations: ${summary.conversations.length}; deliveries: ${summary.deliveries.length}; formal review gates: ${summary.gates.length}.\n- Provider requests: ${summary.total_provider_requests} = one cold warm + ${summary.formal_review_provider_requests} formal reviews; local warm reuse calls: ${summary.local_warm_reuse_calls}; implicit retries: 0.\n- Generation prompt usage: ${summary.generation_usage.prompt_tokens} = hit ${summary.generation_usage.prompt_cache_hit_tokens} + miss ${summary.generation_usage.prompt_cache_miss_tokens}; amortized hit ${(summary.generation_usage.aggregate_cache_hit_ratio * 100).toFixed(4)}%.\n\n| Conversation | Delivery | Gate | Result | Formal cache hit | Prompt accounting |\n|---|---|---|---|---:|---:|\n${rows}\n\nThe fixture is an isolated local reservation service. Its first GREEN contains a deterministic same-key concurrency defect; the reviewer must return exactly one obligation-bound finding. The corrected GREEN, final v1, and all v2 gates must pass. Every tool call launches a fresh MCP process and selected conversation/version boundaries call warm again; registry reuse must keep those calls local with zero Provider requests.\n`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}
