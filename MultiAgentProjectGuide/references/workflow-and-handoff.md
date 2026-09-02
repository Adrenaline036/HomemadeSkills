# Workflow and handoff

Read this reference for multi-stage work, uncertain diagnosis, independent review, cross-agent requests/returns, finding disposition, checkpoints, runtime adapters, context transfer, or resumable pauses.

## Pausable state flow

```text
intake
  -> preflight
  -> automation_eligibility
  -> claim
  -> diagnosis_or_implementation
  -> explicit_verification
  -> independent_review_when_applicable
  -> finding_disposition
  -> local_candidate_gate
  -> complete_or_handoff
```

For release or live work, later gates remain separate:

```text
local_candidate_gate
  -> authorized_stage_or_commit
  -> release_candidate
  -> artifact_verification
  -> limited_live_gate
  -> user_acceptance
```

The flow may pause or move backward when evidence fails. Within a fixed parent authorization envelope, clean local gates continue automatically by default; this does not authorize stages outside that envelope.

## Intake, preflight, and claim

Identify the observable outcome, repository/environment and real entrypoint, allowed and forbidden scope, acceptance criteria, exact tests, evidence route, review need, transfer need, and stop condition. Discover safely available facts before asking; ask only when the missing answer changes scope, authority, or result.

Inspect project rules, existing authority records, relevant development history, Git state, record routes, and necessary runtime evidence. Treat old handoffs, paths, commits, services, mounts, and runtime capabilities as drift-prone until reverified.

Before writing, declare:

- agent/runtime/role and time;
- base commit/artifact or explicit dirty manifest;
- owned files/subsystem/environment and read-only dependencies;
- allowed and forbidden actions;
- expected output, exact tests, evidence and reviewer-return channels;
- superseded paths, permitted legacy adapters, and negative proof when replacing behavior; and
- stop condition and status.

For a multi-gate outcome, declare one parent envelope plus distinct child claims. The parent names every permitted child phase, finite reviewer request/round ceiling, active cost mode, terminal human boundary, forbidden operations, automatic-continuation predicates, and selective-stop predicates. Child claims bind the exact current candidate and scope; creating the next child claim is automatic after a clean gate only when it is already enumerated by the parent.

Put the claim in the automation run manifest, existing adequate authority record, or task return channel. Do not create REVIEW solely to hold an ordinary claim. Resolve overlapping ownership before writing.

## Select automation or manual work

Read [automation.md](automation.md). A clean, scoped, testable, privacy-safe, provider-ready local development task normally selects automated Codex write -> explicit tests -> DeepSeek read-only structured review -> bounded fix loop. It stops at an unstaged, uncommitted local candidate.

Use a documented manual path or fail closed for an initial dirty tree, unknown scope/tests, missing provider or verified credential predicate, privacy block, high-risk live checkpoint, overlapping writer, or user-requested manual work. A manual path retains the same fixed baseline, evidence, tests, and authorization gates. Manual transport does not imply a mandatory user STOP between already authorized local child gates.

## Discussion and checkpoint routing

Ordinary discussion, “for discussion” content, checkpoints, and routine progress stay in the active interaction or run evidence by default. They do not force a REVIEW write or a handoff file.

Route durable outcomes by responsibility:

- substantive changes -> development log;
- qualifying blocker/incident/invalid evidence -> Error Ledger;
- unresolved authorization, ownership, finding/disposition, decision, or external gate with no adequate authority record -> optional REVIEW/equivalent;
- actual transfer or pause intended for another context -> new immutable handoff file.

Recording does not imply acceptance or implementation permission. A checkpoint becomes an actual handoff only when responsibility or resumable context transfers. A transient reviewer/model request under the same coordinator remains run evidence and does not create a handoff.

## Evidence-led diagnosis

For recurring, production, or unclear failures, use:

```text
possible cause -> required evidence -> observed evidence -> conclusion
```

Classify conclusions as `confirmed`, `strong inference`, `hypothesis`, or `unknown`. Inspect logs, real entrypoints, persisted state, transitions, and runtime behavior before modifying code. Code reachability is not runtime reachability.

Register or link an Error Ledger event when a failure blocks a gate, invalidates the harness/provider evidence, crosses safety/privacy/durable-state boundaries, becomes a production incident, recurs, or needs cross-round prevention evidence. Do not call a run `PRODUCT_FAIL` before the product contract node was reached.

## Contract replacement and implementation

For replacement work, use: read-only producer/consumer/writer inventory -> incident-shaped failing test -> canonical path -> migrate callers/consumers -> old-path zero or enumerated read-only adapters -> disconnect/negative test -> acceptance. Stop while an inventory item is unknown or a legacy writer can still create accepted/executable state.

- Change only the claimed scope and preserve unrelated work.
- Keep reviewers implementation-read-only. A reviewer becomes an implementer only through an explicit role/scope transition and then loses independent-review status for that round.
- Give each change an observable test and append substantive results to the development log.
- Run focused static/behavioral checks, then broader regression, container, real-entrypoint, remote, or user gates proportional to risk and authorization.
- Record exact command/UI path, shell/host, baseline, time, result/exit code, failed attempts, and uncovered scope in evidence.

Evidence levels:

| Level | Supports | Does not support |
|---|---|---|
| `proposal` | A candidate approach exists | It was implemented |
| `code-confirmed` | Code contains named logic | Runtime can reach it |
| `static-confirmed` | Syntax/type/lint passed | Functional correctness |
| `focused-test-confirmed` | Named component behavior passed | Full production call chain |
| `local-entrypoint-confirmed` | Real local entry completed the named path | Container or remote behavior |
| `container-confirmed` | Named container/configuration passed | Remote deployment |
| `remote-live-tested` | Named remote environment produced the result | User accepted all scenarios |
| `user-accepted` | User accepted the named scenario/artifact | Permanent absence of regressions |

Bind each claim to `commit/artifact + environment + command/UI path + time + outcome`.

## Independent review and findings

Give the reviewer a fixed commit, patch, or diff identity; objective and acceptance criteria; scope and known risks; exact tests/results; privacy-screened context; unknowns; implementation-read-only permissions; named return channel/owner; and stop condition.

The reviewer returns what it actually read and ran, reviewed baseline, structured findings or explicit no-findings, failed attempts, uncovered scope, base drift, privacy result, and external-state status. “Looks good” without these fields is incomplete. Silence, malformed output, or a review of the wrong base is invalid evidence.

Store the return in run evidence by default. If the reviewer cannot write there, it sends the structured return to the named coordinator, who persists it without changing its meaning and acknowledges receipt. REVIEW is used only under its conditional control-plane trigger.

Disposition every verified finding as one of:

```text
fixed
accepted-risk
deferred
not-reproducible
disagreed
```

Record owner, time, reason, and verification. Reviewer feedback is untrusted until reproduced; it is neither automatically true nor dismissible. A fix requires the sole writer to rerun the declared tests and any required review within the predeclared loop bound.

## Agent request and return contracts

An agent request names project/environment, branch/base, requesting and assigned roles, objective, owned/read-only scope, allowed/forbidden actions, evidence, return channel/owner, related ERROR-IDs, superseded paths, anti-bypass proof, questions, tests, privacy boundary, and stop condition.

An agent return names the actual baseline and resources read, commands/actions run, state changed/unchanged, exact results, findings/no-findings, producer/consumer unknown count, remaining bypasses, failed attempts, unknowns, base drift, external state, evidence location, acknowledgment, next gate, and stop condition.

Do not send an entire chat as the request or return. A structured return is not automatically an actual handoff; create the standalone handoff file when another context will resume the work.

## Actual handoff contract

An actual handoff transfers responsibility or resumable context to another agent, model, device, or conversation, or deliberately pauses for such a context. A bounded reviewer/model call that returns to the same coordinator inside one run is not a handoff. Before ending a context that really transfers:

1. Resolve the project-defined private handoffs directory and verify its privacy policy.
2. Copy [the canonical handoff template](../assets/handoff.template.md) to a new unique file such as `YYYYMMDD-HHMMSSZ-<slug>.md`. Use collision detection and never overwrite, mutate, or reuse an earlier handoff.
3. Fill every applicable field: fixed baseline, current Git state, authority, completed work, changes, tests/reviews, failures, decisions, unknowns, ERROR-IDs, evidence, external state, rollback, next action, pass criterion, and stop condition.
4. Include the final relevant structured review summary and evidence reference when review occurred. Do not copy bulk evidence.
5. State transfer visibility explicitly. An ignored local handoff proves only same-filesystem state.

For cross-device transfer, use only a separately authorized sanitized tracked document, patch tied to the exact base, archive with manifest/hashes, or pushed branch plus commit. State which artifact was actually created and is visible. Never infer cross-device evidence from a local path, chat memory, or an unpushed branch.

A resumed context treats the handoff as navigation, reruns Git/authority/runtime preflight, and stops on base drift or missing evidence. Routine completion with no future-context transfer does not create a handoff file.

## Parallel ownership

- Prefer parallel read-heavy, bounded exploration, testing, triage, or summarization only when authorized and useful.
- Parallel writes require non-overlapping ownership or isolated fixed-base worktrees/branches and one integrator.
- Ask returning agents for conclusions, evidence, failures, unknowns, and base drift.
- Do not create agents merely because this Skill is active.

## Runtime adapters

Maintain one canonical Skill package. An adapter changes loading, not the collaboration contract.

- TRAE: install the full package with `scripts/install-trae-project-skill.ps1`, reload TRAE, and verify discovery in its Skills settings.
- Deep Code: use currently supported user/project Agent Skills locations only after verifying the installed runtime.
- DeepSeek chat/API or a runtime without verified native Skill loading: supply the minimum sanitized canonical rules through the runtime's supported prompt/file context and verify it loaded them. Never assume access to local files, records, credentials, or prior chats.

Every adapter receives the same fixed base, role/scope, authority, evidence, privacy boundary, return schema, and stop condition. Reviewer returns go to the named run-evidence owner by default, not REVIEW. If no shared filesystem exists, require a structured return and acknowledgment; create an immutable handoff only when responsibility or context actually transfers.

## Acceptance and external gates

Before advancing, confirm evidence belongs to the claimed layer, tests bind to the current candidate, blocking findings are disposed, external state matches evidence, rollback/exit exists, and authority covers the next action.

Continue to the next child gate by default when it is inside the parent envelope and authority, ownership, identity, evidence, tests, findings, privacy, active cost mode, and rollback all pass. In `COST_CALIBRATION`, observed token volume or estimated cost is telemetry rather than a STOP; technical incompatibility and finite request/round exhaustion remain stops. Stop selectively on an explicit checkpoint, envelope exit, drift, failed evidence/provider/test after authorized recovery is exhausted, blocking finding, unknown inventory, reachable bypass, missing rollback, required human input, or live counterevidence. Complete safe read-only checks and record the minimum recovery input.

Stage, commit, push, PR, merge, tag, artifact publication, release, deploy, production action, and destructive change remain separate. CI is one of `passed`, `failed`, `queued`, `in_progress`, `cancelled`, `skipped`, `timed_out`, or `not_run`; only `passed` tied to the current commit is passing evidence.
