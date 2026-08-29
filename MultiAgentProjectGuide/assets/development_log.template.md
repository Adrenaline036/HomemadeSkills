# Development log

This file records substantive implementation, test, build, release, deployment, rollback, and operational changes only. Collaboration state, authorization, findings, and handoffs belong in `REVIEW.md`. Raw logs and screenshots belong in the project's evidence directory.

Use the development-log filename already established by the project. Do not create both `development_log.md` and `develop_log.md`.

## Entry format

Append entries in the project's established chronological order. Do not rewrite another agent's historical entry; add a correction entry when needed.

## YYYY-MM-DD HH:mm Z — <short substantive change title>

- Agent/runtime: <name / runtime>
- Role: <implementer / tester / release operator / deployer>
- Repository/worktree: <absolute or stable relative identifier>
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
- Producer/consumer inventory:
  - <complete/unknown count and evidence>
- Anti-bypass validation:
  - <negative/disconnect test and exact result, or not applicable>
- Failed/flaky attempts:
  - <attempt and result, or none>
- Evidence layer: proposal / code-confirmed / static-confirmed / focused-test-confirmed / local-entrypoint-confirmed / container-confirmed / remote-live-tested / user-accepted
- Evidence paths:
  - <relative path to raw log, screenshot, report, manifest, or none>
- External state changed:
  - <no, or exact environment/state change>
- Deployment/release:
  - <not performed, or exact target/version/result>
- Rollback/recovery:
  - <rollback command/artifact/state restoration, or not applicable>
- Remaining risks/unverified:
  - <items or none>
- Related REVIEW records:
  - <CLAIM / FINDING / GATE / DECISION IDs>
- Related Error Ledger records:
  - <ERROR-ID / EVENT-ID / none>
