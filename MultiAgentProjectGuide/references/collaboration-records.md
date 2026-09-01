# Collaboration records

Read this reference before bootstrapping, creating, revising, explaining, or auditing project collaboration files. Templates have one canonical copy under `assets/`; never duplicate their full schemas in project prose.

## Responsibility matrix

| Layer | Default route | Sole responsibility | Keep out |
|---|---|---|---|
| Stable project rules | `AGENTS.md` or runtime Rules | Cross-task environment, entrypoints, invariants, safety, automation eligibility, and record routes | Current status, long logs, temporary decisions |
| Conditional control plane | Optional `REVIEW.md` or established equivalent | Unresolved authorization, ownership, finding/disposition, decision, or external-gate state without another adequate authority record | Routine progress, ordinary discussion, default review returns, full chats |
| Substantive changes | Exactly one existing `development_log.md` or `develop_log.md` | Implementation, configuration, schema, test, build, artifact, release, deployment, rollback, and operational changes | Planning, review-only work, unchanged diagnostics |
| Cross-round error index | Conditional private `error_ledger.md` | Blocking errors, recurrence, invalid evidence, privacy/safety/durable-state events, and production incidents | Permission grants, complete logs, routine failures |
| Run evidence | Project evidence location, with one automation run directory per run | Exact commands/results, sanitized outputs, manifests, reviewed diff identity, structured review returns, and fix-loop dispositions | Secrets and unrelated private data |
| Actual handoffs | Project-defined private `handoffs/` route | One immutable standalone progress document per responsibility/context transfer or resumable pause | Reused mutable dashboard, chat transcript, or transient reviewer call |
| Per-run failures | Existing run-local `failure_ledger.md` or equivalent | Raw failed commands, tool errors, and run-local invalid evidence | Cross-round disposition or current authority |
| Durable decisions | `docs/decisions/ADR-*.md` or project equivalent | Long-lived architecture choice, alternatives, costs, and revisit condition | Routine implementation detail |

Locations are not permission grants. Check repository policy, existing names, `.gitignore`, publication intent, and the authorized write scope before creating or writing them.

## Idempotent bootstrap

Bootstrap records only when a project needs them and the write scope permits it:

1. Inventory existing `AGENTS.md`/Rules, both development-log names, Error Ledger, evidence locations, handoff routes, REVIEW/equivalent authority records, ADR policy, and ignore rules. Consult repository history or project rules before deciding which established name is canonical.
2. Preserve every established file and route. Never initialize over an existing file, rename history for consistency, or create a second approximate template.
3. Keep exactly one development log. If one accepted filename exists, retain it. If neither exists, copy [the development-log template](../assets/development_log.template.md) once using the project's convention. If both exist and authority is unclear, create neither, keep both read-only, and stop for a naming decision.
4. Retain or create one evidence location and one project-defined private handoffs directory. Verify the intended privacy boundary with project policy and `git check-ignore`; a directory name alone does not prove privacy.
5. Create the private append-only Error Ledger from [its template](../assets/error_ledger.template.md) only when a cross-round trigger applies. Do not create it for every project.
6. Create REVIEW from [its template](../assets/REVIEW.template.md) only when explicitly requested, required by existing rules, or needed as the missing control plane for unresolved authorization, ownership, finding/disposition, decision, or an external gate.
7. Keep stable routes and invariants in the existing AGENTS/Rules. If none exists and authorization covers creation, copy [the AGENTS template](../assets/AGENTS.template.md) once and adapt it without current task state.

Repeating bootstrap must leave established files unchanged. Only a new run creates a new run-evidence directory, and only an actual transfer creates a new handoff file.

## AGENTS.md rules

Include only stable rules that affect future decisions:

- operating system, shell, repository boundary, real entrypoints, and exact test routes;
- automation eligibility/fallback policy and the local-uncommitted candidate ceiling;
- architecture, data, compatibility, supersession, and production invariants;
- the single development log, evidence, conditional Error Ledger, optional authority record, and private handoff routes;
- dirty-worktree, privacy, secret, live/durable-data, and unrelated-work protections; and
- operations requiring separate authorization.

Exclude single-bug analysis, complete test output, current task status, temporary decisions, repeated review returns, and model-specific credentials. Prefer revising an existing stable rule over appending a synonym. Runtime Rules should express the same contract rather than fork it.

## Optional REVIEW control plane

REVIEW is not the default destination for ordinary discussion, reviewer returns, checkpoints, routine progress, or handoffs. When its trigger applies:

- name its exact scope and writer; one coordinator owns mutable current state;
- preserve authorization, claims, decisions, findings, dispositions, and gates already in the record;
- write only the unresolved control-plane state that lacks an adequate authority home, plus evidence references needed to adjudicate it;
- keep proposals, accepted decisions, rejected decisions, and superseded decisions distinct;
- keep findings intact and disposition them as `fixed`, `accepted-risk`, `deferred`, `not-reproducible`, or `disagreed` with owner, time, reason, and evidence; and
- link rather than copy run evidence, development-log entries, Error Ledger events, and immutable handoff files.

A pre-existing project rule may require REVIEW updates; obey that exact rule. Otherwise a structured review remains in run evidence, and an actual transfer creates a separate handoff document.

## Ordinary discussion and progress

Content marked “for discussion”, “供讨论”, or equivalent does not by itself force REVIEW or another repository write. Keep ordinary discussion and routine progress in the active interaction or run evidence.

Persist only when the content reaches a durable route:

- a substantive implementation/configuration/schema/test/build/artifact/release/deployment/rollback/operational change -> development log;
- a qualifying blocker, recurrence, invalid harness/provider run, privacy/safety/durable-state event, or production incident -> Error Ledger;
- an unresolved authorization, ownership, finding/disposition, decision, or external gate without adequate authority -> REVIEW/equivalent control plane; or
- an actual transfer or resumable pause -> a new immutable handoff file.

Recording a proposal never turns it into authorization or acceptance. Do not transcribe the full chat into any record.

## Development log

Append only substantive changes to the project's established development-log file. Tie an entry to the fixed baseline, requirement/finding, observable change, exact validation, evidence path, external state, rollback, remaining risk, and applicable authority or ERROR-IDs. For path or contract replacement, also record superseded producers/consumers, retained read-only adapters, unknown count, and negative/disconnect evidence.

Do not log plans, ordinary discussion, read-only inspection, unchanged diagnosis, routine progress, review-only work, or bulk raw output. A reviewer return is referenced only when it materially affects the implemented candidate.

## Error Ledger

Read [the Error Ledger reference](error-ledger.md) before creation, migration, append, or validation. Use its unique template and preserve the v1 validator schema.

- One writer appends events; reviewers return append-ready events unless separately authorized to append.
- Keep exact output in evidence and run-local failures in the run failure ledger.
- The ledger grants no code, Git, release, deployment, external-system, or durable-data permission.
- When REVIEW is absent, use the schema's REVIEW fields to state that it is not required and identify the adequate authority/evidence reference; do not invent a REVIEW file merely to satisfy a label.

## Evidence and reviews

For every meaningful test or review, retain fixed candidate identity, environment, exact command or inspection, time, outcome/exit code, failed or invalid attempts, privacy-screening result, and a stable relative evidence reference. Reviewers always return structured findings or no-findings to the named channel; the coordinator stores that return in run evidence by default.

Evidence must distinguish proposal, code, static, focused test, real local entrypoint, container, remote live, and user acceptance. An ignored evidence path is private only after policy/ignore verification and is never automatically visible across devices.

## Actual handoffs

Read [the workflow and handoff reference](workflow-and-handoff.md) and copy [the unique handoff template](../assets/handoff.template.md). Every responsibility/context transfer to another agent, model, device, or conversation, or pause intentionally meant for another context, creates a new unique timestamp/slug file under the declared private handoffs directory. A transient reviewer/model request and return inside one coordinator-owned run is run evidence, not a handoff. Never update an earlier handoff as a dashboard.

The handoff summarizes and links current evidence; it does not replace the development log, Error Ledger, optional authority control plane, or raw evidence. A local ignored handoff is same-filesystem evidence only. Cross-device transfer requires separately authorized sanitized tracked material, a base-bound patch, an archive with manifest, or a pushed branch plus exact commit, and the handoff must say what the recipient can actually see.

## Privacy, sharing, and archiving

- Verify ignored/private placement with `.gitignore`, `git check-ignore`, and the staged diff before publication. `local/` is not inherently private.
- Never publish credentials, cookies, `.env` contents, databases, full production logs, private endpoints, deployment archives, browser state, media inventories, or personal data.
- Archive only after a milestone when history no longer affects active decisions. Never archive away unresolved authority, open blockers, required rollback data, or evidence still needed by a gate.
