# Project instructions

Replace bracketed fields with the project's stable contract. Remove sections that do not apply; do not store current task state here.

## Environment and entrypoints

- Operating system and shell: <Windows PowerShell / WSL / Linux>
- Repository root: <path>
- Build command: <command>
- Focused test command: <command>
- Full regression command: <command>
- Real user or production entrypoint: <path or UI action>

## Collaboration

- Read `local/development/REVIEW.md` before editing when present.
- Read only relevant entries from the project's existing `development_log.md` or `develop_log.md`; do not create a duplicate log filename.
- Inspect branch, HEAD, upstream, dirty, staged, and untracked state.
- Claim owned files before writing and use one writer for overlapping files or environments.
- Bind review and tests to a fixed commit, patch, artifact, or explicit dirty baseline.
- Treat reviewer read-only scope as a ban on unapproved implementation/runtime mutation, not as a ban on review documentation.
- Every assigned review must produce a structured findings or no-findings return in the named collaboration record/channel; if the reviewer cannot write that record, return it to the designated owner for persistence and acknowledgment.
- Preserve unrelated user and agent changes.

## Diagnosis and evidence

- Diagnose recurring or uncertain failures from logs, persisted state, runtime behavior, and real entrypoints before fixing.
- Distinguish confirmed facts, strong inferences, hypotheses, and unknowns.
- Report exact commands or UI actions, results, failed attempts, unverified items, and evidence layer.
- Do not promote component, local, container, remote, or user-acceptance evidence across layers.

## Safety and authority

- Stage, commit, push, PR, merge, tag, release, deploy, and destructive data changes are separate permissions.
- Do not access production accounts, secrets, or durable data without exact authorization.
- Keep credentials, cookies, private logs, `.env` contents, databases, private endpoints, and personal data out of prompts and public files.
- Stop when ownership, target identity, evidence, authorization, privacy, or rollback is insufficient for the next gate.

## Project-specific invariants

- <Only stable rules that affect future tasks>
