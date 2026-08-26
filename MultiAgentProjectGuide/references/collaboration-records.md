# Collaboration records

Read this reference when creating, revising, explaining, archiving, or auditing project collaboration files. Templates have one canonical copy under `assets/`; this reference defines when and how to use them without duplicating their full text.

## Document responsibility matrix

| Layer | Default location | Sole responsibility | Keep out |
|---|---|---|---|
| Stable project rules | `AGENTS.md` or runtime Rules | Cross-task environment, entrypoints, invariants, safety, and collaboration contract | Current task status, long logs, temporary decisions |
| Current collaboration | `local/development/REVIEW.md` | Current state, authorization, claims, decisions, questions, findings, gates, and handoff | Full chats, bulk raw output, secrets |
| Substantive changes | Existing `local/development/development_log.md` or `develop_log.md` | Code, configuration, schema, test, build, artifact, release, deployment, rollback, and operational changes | Planning, review-only work, unchanged diagnostics |
| Raw evidence | `local/development/evidence/` or project equivalent | Full test output, screenshots, manifests, diagnostic captures | Material every agent must load by default |
| Durable decisions | `docs/decisions/ADR-*.md` or project equivalent | Long-lived architecture choice, alternatives, reasons, costs, and revisit condition | Immediate task state and routine implementation detail |

These are default locations, not permission grants. Check repository policy, `.gitignore`, and publication intent before creating or writing them.

## File-name compatibility

- Prefer the development-log filename already used by the project.
- Do not create both `development_log.md` and `develop_log.md` for the same purpose.
- If both exist, identify the authoritative record from project policy and history before writing; keep the other read-only until the user or repository contract resolves it.
- Do not rename or migrate history merely for consistency without authorization.

## AGENTS.md rules

Copy [the AGENTS template](../assets/AGENTS.template.md) when a project lacks a suitable stable contract, then adapt it to the actual repository.

Include only cross-task rules that affect future decisions:

- operating system, shell, repository boundary, and real entrypoints;
- build, focused-test, full-regression, and real acceptance paths;
- stable architecture, data, and compatibility invariants;
- collaboration-file locations and ownership rules;
- dirty-worktree and durable-data protections;
- operations requiring separate authorization.

Exclude single-bug analysis, complete test output, completed-task requirements, changing current state, duplicated generic advice, and model-specific trivia. Prefer revising an existing rule over appending a synonym. Codex, TRAE, and other runtime Rules should express one contract rather than fork it.

## REVIEW.md rules

Copy [the REVIEW template](../assets/REVIEW.template.md) when creating a collaboration record.

- The current coordinator is the sole writer for `Current state`; rewrite that section as a compact dashboard of now.
- Preserve and append authorization, claims, decisions, questions, findings, gates, dispositions, and session history.
- Update after role or scope change, checkpoint, material failure, review return, finding disposition, external-state change, or handoff. An incidental unchanged read-only check does not need another history entry, but every assigned review requires a durable structured return even when it finds no issues.
- Read-only review forbids unapproved implementation/runtime mutation; it does not forbid collaboration output. A reviewer with explicit append authority records its claim, findings, gate evidence, or session without rewriting `Current state`. Otherwise it returns the same structured material to the coordinator/integrator who owns the file, and that owner persists it.
- Name the review output path/channel and record owner in the request. A review is not complete until its return is written to the authorized record or acknowledged through the named handoff channel.
- A claim names agent/runtime/role, base, owned/read-only scope, allowed and forbidden actions, output, acceptance, stop condition, and status.
- A finding remains intact. Its implementer may mark `fixed`, `accepted-risk`, `deferred`, `not-reproducible`, or `disagreed`, but must provide owner, time, and evidence. Close only after verification or explicit risk acceptance.
- Keep `proposal`, `accepted`, `rejected`, and `superseded` decisions distinct. Track open questions by the evidence needed and which gate they block.
- Preserve failed attempts, unknown/unverified items, external state, rollback, and the next gate. Do not report a final green run while hiding prior failures or flakiness.

Priority convention:

- P0: active data loss, secret exposure, security compromise, or production outage.
- P1: blocks required behavior or release.
- P2: material correctness, reliability, operability, or maintainability issue.
- P3: valuable non-blocking improvement.

## Development-log rules

Copy [the development-log template](../assets/development_log.template.md) only when the project has no authoritative equivalent.

Record substantive changes to code behavior, configuration or environment contract, schema/database/migration, tests, build/artifact, release/deployment/rollback, or operations. Tie each entry to the requirement or finding, baseline, validation, evidence path, external state, rollback, remaining risks, and related `REVIEW.md` IDs. For contract/path replacement, also record the superseded paths, retained compatibility adapters, producer/consumer inventory status, and negative or disconnect evidence that blocks bypass.

Do not log complete chats, plans, ordinary discussion, read-only inspection, unchanged diagnosis, review-only work, ordinary formatting/documentation, temporary coordination already in `REVIEW.md`, or bulk raw logs. Put raw output in the evidence directory and link it.

## Evidence and ADRs

For raw evidence, retain:

- commit/artifact and environment;
- command or UI path, time, outcome, and exit code when available;
- the first relevant error and only the necessary stack context in summaries;
- a stable relative evidence path;
- failed, flaky, cancelled, and timed-out attempts as well as success.

Use an ADR only for a durable architecture decision. Record context, confirmed facts, alternatives, choice and rationale, consequences/risks, and revisit condition. Do not elevate every temporary implementation detail.

## Privacy, sharing, and archiving

- A `local/` path is not automatically ignored. Verify with `.gitignore`, `git check-ignore`, and the staged diff before publication.
- Same-machine agents may share ignored files; cross-machine agents cannot be assumed to see them. Use a sanitized tracked handoff only with approval.
- Never publish credentials, cookies, `.env` contents, databases, full production logs, private endpoints, deployment archives, browser state, media inventories, or personal data.
- Archive after a major milestone, when history no longer affects current decisions, when the current record is hard to navigate, or when unrelated subprojects have accumulated.
- After archiving, retain a current-state dashboard and archive index. Never archive away open findings, unresolved failures, required rollback data, or evidence still needed by an active gate.
