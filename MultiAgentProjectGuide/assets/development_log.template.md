# Development log

This file records substantive implementation, configuration, schema, test, build, artifact, release, deployment, rollback, and operational changes only. Run-scoped tests/reviews and raw output belong in evidence; qualifying blockers/incidents belong in the Error Ledger; actual transfers belong in independent immutable handoff files. REVIEW is optional and contains only qualifying unresolved control-plane state.

Use the development-log filename already established by the project. Do not create both `development_log.md` and `develop_log.md`, overwrite an existing log during bootstrap, or append plans, ordinary discussion, routine progress, review-only work, unchanged diagnostics, or bulk output.

## Entry format

Append entries in the project's established chronological order. Do not rewrite another agent's historical entry; add a correction entry when needed.

## YYYY-MM-DD HH:mm Z — <short substantive change title>

- Agent/runtime: <name / runtime>
- Role: <implementer / tester / release operator / deployer>
- Repository/worktree: <stable repository/worktree identifier>
- Branch / commit / artifact: <branch / sha / dirty / artifact ID>
- Requirement/finding: <user requirement / FINDING ID / issue / decision>
- Changed:
  - <file/config/schema/test/build/deployment change>
  - <observable behavior difference>
- Superseded/removed paths:
  - <none or exact contracts/callers/writers retired>
- Retained compatibility adapters:
  - <none or exact read-only adapters and limits>
- Reason:
  - <why this change was necessary>
- Compatibility and data impact:
  - <none or exact impact>
- Validation:
  - `<exact command or UI path>` → <exact result / exit code>
  - `<second check>` → <exact result>
- Automation/manual workflow:
  - <automation run ID and fix iteration, or documented manual fallback reason>
- Structured review:
  - <reviewer / reviewed candidate / findings disposition / run-evidence reference / not required>
- Producer/consumer inventory:
  - <complete/unknown count and evidence>
- Anti-bypass validation:
  - <negative/disconnect test and exact result, or not applicable>
- Failed/flaky attempts:
  - <attempt and result, or none>
- Evidence layer: proposal / code-confirmed / static-confirmed / focused-test-confirmed / local-entrypoint-confirmed / container-confirmed / remote-live-tested / user-accepted
- Evidence paths:
  - <relative path to raw log, screenshot, report, manifest, or none>
- Candidate/Git state:
  - <unstaged/uncommitted local candidate, or separately authorized exact Git state>
- External state changed:
  - <no, or exact environment/state change>
- Deployment/release:
  - <not performed, or exact target/version/result>
- Rollback/recovery:
  - <rollback command/artifact/state restoration, or not applicable>
- Remaining risks/unverified:
  - <items or none>
- Related authority/REVIEW records:
  - <none or CLAIM / FINDING / GATE / DECISION / other authority reference>
- Related Error Ledger records:
  - <ERROR-ID / EVENT-ID / none>
- Related immutable handoff:
  - <none or path created for an actual transfer>
