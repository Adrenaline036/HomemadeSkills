# Production readiness review

Use this review for changes that can mutate durable data, alter a production entrypoint or state machine, change persistence/recovery behavior, or support a release/deployment claim. It is also mandatory after a live incident invalidates prior local evidence.

The objective is not to accumulate test counts. The objective is to prove that the shipped production path performs the intended behavior, preserves its invariants across failure, and always leaves the operator a safe exit.

## 1. Freeze the claim after an incident

Before implementing another fix:

1. Mark the affected candidate and acceptance gate as failed. Withdraw `deployable`, production-ready, or equivalent promotion claims.
2. Preserve the exact artifact, source identity, configuration, logs, screenshots, persisted records, and user report. Do not overwrite the failed candidate or delete evidence to simplify the next test.
3. Separate observed impact from inferred cause. Treat user/live evidence as authoritative for what happened, without blaming the operator for exercising an exposed workflow.
4. Record three escape statements:
   - the production defect;
   - the missing or incorrect production path/state transition;
   - why the previous tests and review did not detect it.
5. Turn the live counterexample into a failing contract test before modifying the implementation whenever reproduction is safe.

## 2. Build a proof-obligation matrix

For every release-critical requirement, record:

| Obligation | Required evidence |
|---|---|
| Production entry | Exact user/API/scheduler/worker entrypoint that initiates the behavior |
| Reachability | Call or event path from that entrypoint to the new implementation |
| State sequence | Persisted states and transitions created by the real path |
| Authority | Single source of truth for identity, revision, approval, and recovery routing |
| Supersession | Canonical replacement, superseded paths, allowed read-only adapters, and complete producer/consumer inventory |
| Anti-bypass | Negative or disconnect evidence that no alternate or legacy path reaches an accepted or executable state |
| Side effects | Files, database rows, messages, remote calls, or live resources changed |
| Failure cases | Fault injection before and after each durable boundary |
| Operator closure | Retry, repair/rebind, or safe abandon action for every non-terminal state |
| Acceptance | Automated, runtime, independent-review, and limited-live evidence still required |

A requirement is uncovered until every applicable column has a named test or observation. A large full-suite count does not close a blank obligation.

## 3. Prove production reachability

- Trace from the real production entrypoint. Definitions, imports, isolated component tests, and direct calls to an internal resolver/service do not prove production wiring.
- Confirm the shipped entrypoint invokes the implementation under the same guards, configuration, dependency injection, worker, and persistence layer used in production.
- Add a regression that fails if the wiring call is removed or bypassed. A test that still passes after disconnecting the new component is not a production-path test.
- Inspect both static reachability and an observed runtime trace, persisted transition, or spy at the production boundary.
- Verify ordinary control flows as well as the new feature so specialized routing does not hijack unrelated work.

## 4. Prove supersession and anti-bypass

When a change replaces an authority, contract, state transition, or execution path, proving that the new path works is only half of the obligation. Also prove that the superseded path cannot remain an accidental authority.

1. Build a read-only inventory of every definition, production and test caller, persisted consumer, UI/API/scheduler/worker/batch/replay/recovery entry, compatibility adapter, and direct save, patch, or mutation point.
2. Classify each item as canonical, superseded, permitted read-only adapter, or unknown. Promotion is blocked while the unknown count is nonzero.
3. Declare one canonical writer or authority and the exact contracts or paths it supersedes. Compatibility code may translate or read legacy state only when explicitly allowed; it must not create new accepted state through the old contract.
4. Require both positive and negative proof: the canonical path produces the intended result, and every bypass, second writer, direct mutation, or legacy producer is absent, rejected, or fail-closed.
5. For high-risk migrations, enforce a machine-readable call-site allowlist, structural/static gate, or equivalent test so an unregistered caller, second implementation, or forbidden direct save fails validation.
6. Disconnect or disable the canonical authority and exercise every real production entry. Each entry must fail closed. If a test still succeeds while the authority is disconnected, it does not prove production wiring.
7. Carry a mandatory current schema/revision/fingerprint/receipt across persistence, approval, execution, and recovery. An optional boolean or marker is not proof of current authority.
8. Treat legacy objects as read-only or stale and provide replan, repair/rebind, or safe abandon. Never silently fall back to superseded logic.
9. Preserve the decisive incident shape in regression fixtures, including state order, overlapping relationships, persistence boundaries, and input/provider shape. A simplified happy-path fixture cannot close an incident-shaped obligation.

A safe migration sequence is: inventory → incident-shaped failing test → canonical path → migrate every producer and consumer → reduce old paths to zero or enumerated read-only adapters → disconnect/anti-bypass tests → acceptance. Stop at the first unknown or reachable bypass.

## 5. Exercise a real state sequence

Run at least one test through the same public entry and transitions an operator uses:

```text
request/task creation
-> discovery or provider selection
-> authoritative decision
-> immutable plan/projection
-> approval
-> execution
-> durable registration
-> completion or recovery
```

- Let the production path create downstream snapshots, plans, revisions, fingerprints, ledgers, and catalog records. Do not construct those downstream objects directly in the end-to-end fixture.
- Synthetic fixtures remain useful for unit and UI tests, but label them as component evidence. They cannot promote a release by themselves.
- At every transition, assert identity, backend, key, revision, fingerprint, approval, and failure-routing fields against one authoritative state source.
- Reject stale approvals and split-brain projections. Execution, UI, and recovery must resolve the same frozen identity through the same contract rather than infer it independently.
- Treat `awaiting_user`, `pending_review`, or an equivalent operator-decision state as intermediate, never as successful completion. Prove persistence, restart, resumption, and the eventual execution or safe-exit chain.
- Prefer structured failure codes and frozen identifiers over parsing user-facing error strings.

## 6. Audit failures and partial success

Inject or reproduce failures at every durable boundary, including:

- before the first side effect;
- after a side effect but before its ledger/registration update;
- after the execution ledger but before a secondary catalog/index update;
- process restart during each pending state;
- missing, moved, replaced, or externally removed source/target evidence;
- stale revision, changed identity, duplicate request, and concurrent execution;
- unavailable provider, database, filesystem, or network dependency.

For each case, prove idempotency, no silent overwrite, no duplicate side effects, preserved audit evidence, and an accurate user-visible state. Test restart and recovery against persisted records, not only in-memory objects.

## 7. Require recovery and safe abandon closure

Every reachable non-terminal state must have at least one truthful, usable exit:

- retry when prerequisites remain valid;
- repair, relocate, or rebind when evidence supports it;
- abandon the active workflow when recovery prerequisites can no longer be satisfied.

Audit each UI/API action through the command it actually executes. A visible button or successful render is not proof that its promised operation exists.

The abandon path must be explicit and confirmed. By default it may remove active task, pending plan, and review state, while preserving immutable ledger/audit evidence. It must not delete or rewrite user data, media, completed side effects, catalogs, or external resources unless a separately authorized destructive operation explicitly covers those targets.

No task may be trapped because the only offered recovery requires evidence that the product already knows is missing. If no safe automated recovery exists, provide a non-destructive closure plus clear residual-risk reporting.

## 8. Rebuild candidate identity and evidence

After the production-path and recovery contracts pass:

1. Re-run focused regression and the complete relevant suite.
2. Build from an exact, enumerated source context; compare source and artifact contents and exclude private/forbidden files.
3. Verify runtime version/build identity, configuration, permissions, health, and real browser/API workflow separately.
4. Preserve failed attempts in the record. Do not rerun until green and report only the final pass.
5. Keep evidence labels distinct: component, production-path automated, local runtime, container, browser/API, limited live, and user accepted.

An artifact may be called a candidate after local gates pass. It must not be called deployable or production-accepted until the required limited-live gate passes.

## 9. Perform independent review against the matrix

The independent reviewer must receive the raw diff, tests, proof-obligation matrix, incident counterexample, and exact candidate identity. The reviewer must:

- inspect the real entrypoint and reachability, not only the new component;
- inspect the complete producer/consumer inventory, require an unknown count of zero, and enumerate every retained legacy adapter;
- disconnect the canonical authority and verify real-entry tests fail closed rather than succeeding through a bypass;
- check that the end-to-end fixture does not inject downstream state that production should create;
- verify each recovery action reaches the claimed command and changes the correct authoritative state;
- independently rerun focused tests and a representative full suite;
- compare evidence claims to actual outputs and identify uncovered matrix cells;
- report whether removing production wiring or breaking an exit path would make a test fail.
- reject skipped tests, expected failures, broad exception wrappers, or mocks that let a broken bypass/disconnect scenario appear green.

Read-only review limits production, implementation, artifact, and runtime mutation; it does not permit a silent return. The reviewer must persist or hand off a structured findings or no-findings result through the named review channel. A no-findings result still identifies the reviewed artifact, matrix coverage, commands or inspections, failed attempts, unknowns, external-state status, and next gate. Implementing a fix requires an explicit role and scope transition before any write.

Self-review and a second model reviewing only prose are not independent verification.

## 10. Use a bounded live acceptance gate

- Use an isolated target, reversible configuration, representative failing scenario, and an ordinary unaffected control case.
- Capture pre-change state, backup/rollback method, artifact identity, exact actions, expected transitions, and stop conditions.
- Inspect actual persisted state and user-visible behavior, not just directory shape, HTTP health, or container status.
- Stop immediately on unexpected writes, identity drift, missing exit actions, duplicate effects, or mismatch with the proof matrix. Preserve evidence and return to the freeze step.
- Promote the candidate only after the named live acceptance passes. Local/container/browser evidence cannot substitute for it.

## Release decision record

End the review with one status:

- `blocked`: one or more proof obligations or safe exits are missing;
- `locally_verified_candidate`: production-path automated/runtime gates passed, live acceptance pending;
- `live_accepted`: the named isolated live gate passed for the exact artifact;
- `withdrawn_after_incident`: live evidence invalidated the prior claim; artifact retained for diagnosis only.

Record remaining risks, exact evidence layers, independent reviewer, artifact/commit identity, rollback, and the next gate. Never use “tests passed” as a standalone production-readiness conclusion.

The candidate remains `blocked` when an inventory item is unknown, a superseded path or alternate writer can still create accepted state, a retained adapter is not proven read-only, or disconnecting the canonical authority does not make every real entry fail closed.
