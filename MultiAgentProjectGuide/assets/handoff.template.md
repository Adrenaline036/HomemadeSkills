# Progress handoff

Copy this template to the project's declared private handoffs directory as `YYYYMMDD-HHMMSSZ-<unique-slug>.md`. Create a new file for every actual responsibility/context transfer or pause meant to resume in another context. A transient reviewer/model call inside one coordinator-owned run is not a handoff. Never overwrite or reuse a prior handoff file.

## Identity and transfer

- Handoff ID: <unique ID matching the filename>
- Created / timezone: YYYY-MM-DD HH:mm:ss Z
- Project / repository: <stable identifier>
- From agent / model / device / conversation: <source context>
- To owner / context: <named recipient or next qualified context>
- Transfer reason: <why another context must resume>
- Local handoff path: <private relative path>
- Cross-device transfer artifact: <none, or authorized sanitized tracked document / base-bound patch / archive plus manifest / pushed branch plus commit>
- Actually visible to recipient: <verified artifact and identity, or local-only / unknown>

## Fixed baseline and current state

- Fixed baseline: <commit / artifact / dirty manifest and fingerprint>
- Branch / current HEAD / upstream: <exact values>
- Git state: <clean/dirty; staged, unstaged, untracked, and ignored candidate files>
- Base drift since work began: <none or exact change>
- Runtime / shell / relevant environment: <sanitized stable identifiers>
- Active role and single-writer owner: <role / owner>

## Authority and boundaries

- Authority source: <user task / AGENTS / optional REVIEW or equivalent record>
- Allowed scope/actions: <exact paths and actions>
- Forbidden or separately gated actions: <stage/commit/push/PR/merge/release/deploy/production/durable data/etc.>
- Sensitive-data/privacy boundary: <what was excluded and screening result>
- Current gate and authorization still required: <exact next gate>

## Work completed

- Completed outcome: <observable work finished>
- Files/config/schema/tests/artifacts changed: <exact list and behavior>
- Substantive development-log entries: <relative references or none>
- Superseded paths / retained adapters / unknown count: <exact status or not applicable>

## Tests and reviews

- Commands or UI paths and exact results: <test, exit code, evidence layer>
- Failed/flaky/skipped attempts: <preserved result and impact, or none>
- Review baseline and reviewer: <identity>
- Structured findings/no-findings and dispositions: <summary plus run-evidence reference>
- Unverified test/review scope: <items or none>

## Failures, decisions, and unknowns

- Open blockers/findings: <IDs, owner, impact, or none>
- Related ERROR-IDs and latest event: <IDs/references or none>
- Decisions and rationale: <accepted/proposed/rejected/superseded with authority>
- Unknowns / hypotheses / base risks: <items or none>
- Evidence locations: <private relative paths, manifests, or hashes>

## External state and recovery

- External/live/durable state: <deliberately unchanged / exact authorized change / unknown>
- Git/CI/PR/release/deployment state: <each separately, including not_run/not performed>
- Rollback or recovery: <command/artifact/state restoration, or not applicable>
- Recipient prerequisites: <files, provider, access, or user action still needed>

## Resume contract

- Next owner and single next action: <owner / action>
- Pass criterion: <observable result tied to the fixed candidate>
- Stop condition: <where the resumed context must pause>
- Fresh preflight required: <Git/authority/runtime checks that must be repeated>
