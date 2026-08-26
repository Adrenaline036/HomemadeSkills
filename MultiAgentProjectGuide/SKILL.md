---
name: guide-multi-agent-project
description: Coordinate multi-agent or resumed project work through scoped authority, single-writer ownership, durable records, fixed baselines, evidence layers, review disposition, and resumable handoffs. Use when multiple agents may touch one project; when REVIEW.md, development_log.md, or develop_log.md is present; or when work spans review, CI, release, deployment, durable/live data, or production recovery. Do not use for an ordinary single-agent edit that needs no shared state or external gate.
---

# Guide Multi-Agent Project

Coordinate agents through repository files, fixed code or artifact state, scoped authority, and verifiable evidence. Never assume access to another agent's hidden chat, memory, credentials, browser state, or environment.

## Preflight and authority

Before writing:

1. Read applicable `AGENTS.md`, TRAE Rules, repository instructions, the current collaboration record, and relevant development-log entries.
2. Inspect branch, HEAD, upstream, remotes, dirty/staged/untracked state, relevant diff, and any required runtime state. Current evidence outranks an old handoff.
3. Declare agent/runtime/role, base commit or artifact, owned and read-only scope, allowed and forbidden actions, expected output, acceptance method, and stop condition.
4. Apply standing authorization only to its exact repository, branch, operation, target, gate, and grant. Skill activation never grants commit, push, deployment, credentials, production access, or durable-data mutation.
5. If the next external or destructive action is uncovered, finish safe local/read-only work, record the exact blocker, and request only the missing authority or input.

## Ownership and roles

- Use one writer or integrator for overlapping files, `REVIEW.md` current state, branches, migrations, schemas, lockfiles, generated outputs, binary artifacts, deployment configuration, and live environments.
- Isolate parallel writes with non-overlapping scope or separate branches/worktrees fixed to a base commit. Require the returning commit or patch and a base-drift report.
- Preserve unrelated user and agent changes. Do not reset, clean, discard, stash, rebase, amend, force-push, or overwrite unknown work merely to obtain a clean tree.
- Name role transitions among coordinator, implementer, reviewer, tester, release operator, and deployer. Self-review is never independent review.
- Do not create extra agents merely because this Skill loaded. Delegate only bounded, independent work that benefits from parallel or independent evidence and has a safe ownership boundary.

## Records and evidence

- Keep stable cross-task rules in `AGENTS.md`; current coordination, authority, claims, findings, gates, and handoff in `REVIEW.md`; substantive implementation or operational changes in the project's existing `development_log.md` or `develop_log.md`; raw outputs in an evidence directory; and durable architecture decisions in ADRs.
- Do not create both development-log filenames. Preserve the project's established authority and history.
- Rewrite only `REVIEW.md` current state; preserve claims, findings, dispositions, decisions, gates, and session history. Never silently delete a finding or another agent's record.
- Separate confirmed facts, strong inferences, hypotheses, unknowns, failed attempts, and unverified items.
- Bind evidence to `commit/artifact + environment + command or UI path + time + outcome`. Never promote code, static, focused-test, local-entrypoint, container, remote-live, or user-acceptance evidence across layers.
- Keep credentials, cookies, `.env` contents, databases, private endpoints, full production logs, deployment packages, personal data, and machine-specific private records out of prompts and public commits.

## Workflow and conditional references

Use a pausable flow: intake → preflight → claim → diagnosis → implementation → focused verification → broader verification → independent review when required → finding disposition → acceptance gate → handoff or completion.

- For document responsibilities, naming compatibility, privacy, archiving, evidence/ADR placement, or when creating/auditing collaboration files, read [references/collaboration-records.md](references/collaboration-records.md). Copy the unique templates from `assets/`; do not maintain divergent copies in project prose.
- For multi-stage work, uncertain diagnosis, cross-agent requests/returns, independent review, findings, context snapshots, runtime adapters, or checkpoints, read [references/workflow-and-handoff.md](references/workflow-and-handoff.md).
- Before durable/live mutation, production-entry or recovery-state changes, replacing an authority, contract, or execution path, deployment claims, or after live evidence invalidates a candidate, read [references/production-readiness-review.md](references/production-readiness-review.md).

Diagnose uncertain or recurring failures before fixing. Make the smallest coherent change within the claim, verify focused behavior before broader layers, disposition every finding with evidence, and pause at the named gate.

When replacing existing behavior, treat supersession as a separate proof obligation: inventory every producer, consumer, and bypass; declare the canonical path and any permitted read-only adapter; and require evidence that superseded logic can no longer create an accepted or executable state.

## External actions and stopping

- Treat stage, commit, push, PR, merge, tag, artifact publication, release, deploy, and destructive data change as separate permissions and results.
- Review intended diff and privacy exposure before publication. Bind CI to the current commit and report only `passed`, `failed`, `queued`, `in_progress`, `cancelled`, `skipped`, `timed_out`, or `not_run`; only `passed` is passing evidence.
- Stop when authority, target identity, ownership, critical evidence, current baseline, blocking-finding disposition, privacy, rollback/exit path, or production counterevidence prevents the next gate. Difficulty alone is not a blocker.

## Complete the handoff

Report what changed and did not change; baseline and current commit/artifact; dirty/staged/untracked state; role and owned scope; commands or UI actions with exact results; failed/flaky attempts; evidence layers; findings and dispositions; unknown/unverified items; external state; authorization used; rollback; next owner/action; pass criterion; and stop condition.

When agents do not share a filesystem, hand off a pushed branch plus exact commit, a patch tied to its base, or a sanitized archive with manifest and hashes. Never send secrets or private runtime data for convenience.
