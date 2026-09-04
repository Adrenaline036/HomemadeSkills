# Error Ledger

Use an Error Ledger only when a project needs a cross-round index of blocking errors, recurrence, remediation, and prevention evidence. It is optional for small or one-shot work.

## Authority and boundaries

The ledger is append-only error history, not a permission grant or general project dashboard:

- `AGENTS.md`, the current user/task authorization, and any established authority record govern scope and permission;
- optional `REVIEW.md` owns unresolved authorization, ownership, finding/disposition, decision, or external-gate state only when project rules require it or no adequate authority record exists;
- `error_ledger.md` links qualifying blocking symptoms, diagnoses, containment, remediation, verification, recurrence, and prevention across rounds;
- the development log records substantive implementation, test, configuration, build, artifact, release, deployment, rollback, and operational changes;
- run evidence stores exact outputs, manifests, privacy results, structured reviews, and fix-loop results; and
- a run-local failure ledger retains failed commands and tool errors from that run.

The v1 schema retains the headers `Canonical REVIEW record` and `REVIEW reference` for compatibility. When REVIEW is not required, fill them with `none` plus the actual adequate authority/evidence reference; do not create REVIEW merely to satisfy a field label. If the ledger conflicts with the current authority record on disposition or gate, stop for coordinator resolution. Never let a validator choose authority.

## Activation and classification

Open or link an error when it:

- stops a gate, promotion, release, deployment, or real acceptance;
- invalidates the run's evidence as `HARNESS_INVALID` or `UNKNOWN_STOP`;
- crosses a process-safety, permission, privacy, secret, media, durable-data, or external-state boundary;
- causes a user-visible production incident;
- recurs from the same root cause or protection gap;
- needs a cross-round disposition or independently verified prevention check.

Do not promote expected negative tests, harmless warnings, one-off command typos with no lasting value, complete log copies, or unsupported guesses. A necessary hypothesis is allowed only when labeled `hypothesis`.

Keep three dimensions separate:

- category: `PRODUCT`, `HARNESS`, `PROVIDER`, `TOOL`, or `UNKNOWN`;
- gate effect: `blocking=yes|no`, the exact blocked gate, and optional P0-P3 priority;
- evidence confidence: `confirmed`, `strong-inference`, `hypothesis`, or `unknown`.

Use one mutually exclusive run classification: `PRODUCT_FAIL`, `HARNESS_INVALID`, `VALID_INTERMEDIATE`, `PROVIDER_OBSERVATION_DRIFT`, or `UNKNOWN_STOP`. A failed harness or a valid intermediate state is not a product failure.

## Append-only event model

Copy [the canonical template](../assets/error_ledger.template.md). Use stable `ERROR-ID` values and append events:

- `OPENED`, `DIAGNOSIS`, `CONTAINMENT`, `REMEDIATION`, `VERIFIED`, `DISPOSITION`, `RECURRENCE`, or `SUPERSEDED-LINK`.

Never edit or delete a historical event to improve the narrative. Preserve the evidence boundary that existed at the time. Later proof may append a verified prevention event, but it cannot retroactively clear an old `unknown`.

Before appending, build the proposed event as a separate draft and validate that draft plus the prior ledger. Append only the exact validated block, then rerun the validator against the resulting ledger. This prevents a malformed event from corrupting the append-only canonical file. Derive enum values and required fields from the installed template/validator rather than memory. A validator failure leaves the canonical ledger unchanged and is recorded in run evidence.

Only these canonical dispositions are valid: `fixed`, `accepted-risk`, `deferred`, `not-reproducible`, and `disagreed`. `fixed` requires verification against a fixed candidate. `accepted-risk` requires an authorized owner, time, reason, and scope. `deferred` names its owner, revisit condition, and blocked gate. `not-reproducible` is not `fixed`.

## Ownership and multi-agent returns

- Claim one writer/integrator for the ledger before writing.
- A reviewer is implementation-read-only and ledger-read-only unless the review request explicitly grants append authority. Without it, return a complete append-ready event to the record owner and require acknowledgment in the named channel.
- Store routine review findings/no-findings in run evidence. A reviewer never rewrites an old ledger event or coordinator-owned authority state.
- Changing from reviewer to implementer requires a new role/scope claim and ends independent-review status for that round.
- Resolve concurrent event conflicts by preserving both inputs and appending a conflict/resolution event; never delete one side.

Routine checkpoints reference the related `ERROR-ID` in run evidence. Every actual transfer creates a new immutable handoff document carrying the fixed baseline, related `ERROR-ID`, minimum evidence, unknowns, external state, next owner/action, pass criterion, and stop condition.

## Privacy

Use a declared private path such as `local/development/error_ledger.md`, then verify the actual ignore boundary. `local/` is not inherently private.

Store sanitized summaries and relative evidence references. Never store credentials, cookies, tokens, `.env` contents, secret paths or hashes, private endpoints, database contents, browser state, complete media inventories, personal data, complete console logs, large stack traces, unredacted absolute paths, or process environments.

## Read-only validator

Run:

```powershell
python -X utf8 scripts/validate_error_ledger.py <ledger> --repo-root <project-root>
```

Add `--previous <prior-ledger>` to prove historical events were not deleted or edited. Add `--review <REVIEW.md>` only when that REVIEW file is an applicable authority record and disposition consistency must be checked.

Projects may extend the source category vocabulary by repeating `--allow-category <NAME>` while retaining the same separate blocking, priority, confidence, and run-classification fields.

The validator checks schema, IDs, event order, time zones, required fields, enums, fixed/accepted-risk evidence, recurrence links, append-only history, privacy patterns, private placement, and optional REVIEW consistency. It never edits the ledger. PASS proves structure and internal consistency only; it does not prove the product fixed, the gate passed, or any action was authorized.

For provider-review incidents, keep the provider observation separate from the harness diagnosis. Record the request/response classification, model, finish reason, sanitized usage, compact-return validation, stable-prefix hash, request count, retry state, and evidence path. Do not label an empty response as a product failure or fixed review result. A harness correction may append `REMEDIATION`; append `VERIFIED` only after the relevant fixture or real-entrypoint prevention check passes at the declared evidence layer.

## Minimal migration

Do not backfill every old failure. Migrate only errors that still block a gate, have a confirmed recurrence family, crossed safety/privacy/durable/production boundaries, or retain deferred/accepted-risk work that needs later verification. Link original findings and evidence; preserve `unknown` when identity or reproduction is missing.
