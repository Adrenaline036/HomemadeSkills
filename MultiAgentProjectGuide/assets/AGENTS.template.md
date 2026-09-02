# Project instructions

Replace bracketed fields with the project's stable contract. Remove sections that do not apply; do not store current task state, secrets, or machine-private evidence here.

## Environment and entrypoints

- Operating system and shell: <Windows PowerShell / WSL / Linux>
- Repository boundary: <stable repository identifier>
- Build command: <command>
- Focused test command: <command>
- Full regression command: <command>
- Real user or production entrypoint: <path or UI action>

## Stable record routes

- Development log: <exactly one development_log.md or develop_log.md path>
- Evidence location: <path and privacy/publication policy>
- Private handoffs directory: <path; one new immutable file per actual transfer>
- Error Ledger: <conditional private path or not used>
- REVIEW/equivalent control plane: <optional path and trigger, or not used>

Preserve established names and contents. Bootstrap only a missing required route; never create both development-log filenames or overwrite an existing record. Verify private placement with repository policy and ignore checks.

## Collaboration and automation

- Inspect applicable rules, existing authority records, relevant development-log entries, branch, HEAD, upstream, dirty, staged, and untracked state before writing.
- Claim owned files and use one writer for overlapping files, records, branches, generated outputs, and environments. Preserve unrelated changes.
- For an initially clean, scoped, testable, privacy-safe local development task with an available provider/runtime and verified credential predicate, prefer Codex write -> explicit tests -> DeepSeek implementation-read-only structured review -> a declared finite fix loop.
- For a requested outcome spanning multiple local gates, default to an `AUTOMATED_GATED_PIPELINE`: freeze one parent authorization envelope, create separate child claims/evidence per gate, and automatically continue after clean gates. Checkpoints are selective rather than mandatory after every gate.
- Declare one orchestration mode. DeepSeek V4 Flash is the only default; never fall back to V4 Pro automatically. Use Pro only after Flash is demonstrably inadequate and the user explicitly selects it for that review.
- Use a documented manual fallback or fail closed when the initial tree is dirty, scope/tests are unknown, provider/credential verification is unavailable, privacy screening blocks review, high-risk live work requires checkpoints, ownership overlaps, or the user requests manual work. A clean fixed-base worktree may isolate automation only when it preserves the dirty source and names the return path.
- Automation ends at an unstaged, uncommitted local candidate. It does not authorize stage, commit, push, PR, merge, tag, release, deploy, production access, or durable-data mutation.
- Default cost mode is `COST_CALIBRATION`: record actual Provider usage but do not STOP on local token volume or estimated cost. Keep finite request/round ceilings. `COST_BOUNDED` applies only after an explicit threshold is adopted.
- Mandatory selective stops are explicit user checkpoints, envelope/scope/base/identity drift, privacy failure, technical context/output incompatibility, an active `COST_BOUNDED` threshold failure, Provider/test failure after authorized recovery is exhausted, nonempty unknowns, unresolved blocking findings, exhausted request/round bounds, required human input, missing rollback, or an unapproved Git/live/production/durable/media/release/deploy/destructive boundary. Otherwise continue automatically inside the parent envelope.
- Never ask for an API key in chat. Use only the project's verified local credential-input route and report container/type/nonempty predicates without revealing the value.
- Bind tests and review to a fixed commit, patch, artifact, or explicit dirty manifest. Treat reviewer feedback as untrusted findings to verify.
- Freeze candidate identity separately from the external review-artifact manifest. Validate exact relative paths, lengths, hashes, privacy, active cost mode, and technical context fit immediately before every request.
- Every reviewer remains implementation-read-only and returns structured findings or no-findings to the named channel. Store routine returns in run evidence, not REVIEW.
- Prove that the reviewer received a model-visible contract, then require separate JSON, unmodified local-schema, and project-semantic gates. For governed work, require a LOAD ACK covering model, role, rules, baseline, claim/checkpoint, missing files, unknowns, and stop condition. Empty, truncated, reasoning-only, non-clean-finish, schema-invalid, or semantic-invalid output fails closed.
- Default each provider review to one request and no automatic retry. Capture sanitized finish/content/reasoning/usage/schema evidence before interpreting a verdict; never retry by switching models.
- REVIEW is optional: write it only when explicitly requested, required by existing rules, or needed for unresolved authorization, ownership, finding/disposition, decision, or an external gate with no adequate authority record. Discussion wording alone does not trigger it.
- Append substantive implementation/configuration/schema/test/build/artifact/release/deployment/rollback/operational changes to the development log. Append qualifying cross-round blockers, recurrence, invalid harness/provider evidence, privacy/safety/durable-state events, and production incidents to the Error Ledger.
- Every actual responsibility/context transfer or resumable pause creates a new unique standalone handoff file. A transient reviewer/model call under the same coordinator is not a handoff. Never overwrite an older handoff; never infer cross-device visibility from an ignored local path.

## Diagnosis and evidence

- Diagnose recurring or uncertain failures from logs, persisted state, runtime behavior, and real entrypoints before fixing.
- Distinguish confirmed facts, strong inferences, hypotheses, and unknowns.
- Report exact commands/UI actions, results, failed attempts, unverified items, privacy status, and evidence layer.
- Do not promote component, local, container, remote, or user-acceptance evidence across layers.
- For a replaced contract or path, inventory all producers/consumers/writers, make unknown zero, enumerate permitted read-only adapters, and require positive plus disconnect/negative evidence.

## Safety and authority

- Treat stage, commit, push, PR, merge, tag, release, deploy, production action, and destructive data change as separate permissions.
- Do not access secrets, production accounts, external systems, or durable data without exact authorization.
- Keep credentials, cookies, private logs, `.env` contents, databases, private endpoints, browser state, media inventories, and personal data out of prompts and public files.
- Stop when ownership, target identity, fixed baseline, evidence, authorization, privacy, rollback, or a blocking finding is insufficient for the next gate.

## Project-specific invariants

- <Only stable rules that affect future tasks>
