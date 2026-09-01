# Project collaboration control plane

This record is optional. Create it only when explicitly requested, required by project rules, or needed to persist unresolved authorization, ownership, finding/disposition, decision, or external-gate state with no adequate authority record. Do not use it as the default destination for ordinary discussion, routine progress/checkpoints, run-scoped tests/reviews, or actual handoffs.

## Current control state

- Updated: YYYY-MM-DD HH:mm Z
- Coordinator/agent/runtime: <name / runtime>
- Repository/environment: <stable identifier / shell>
- Branch / HEAD / upstream: <branch / sha / upstream>
- Dirty, staged, and untracked state: <clean or exact files>
- Objective: <one observable outcome>
- Why this control plane is required: <explicit rule/request or unresolved control-plane need>
- Authority source: <user task / rule / prior decision>
- Evidence location and owner: <relative path / agent or role>
- Development log: <established path>
- Error Ledger and related ERROR-IDs: <none or path / IDs>
- Active roles and claims: <CLAIM IDs>
- Verified evidence: <layer and exact result/reference>
- Unknown/unverified: <items or none>
- Open findings/blockers: <FINDING IDs or none>
- External state: <changed / deliberately unchanged / unknown>
- Next gate: <action, authority required, pass criterion, stop condition>
- Latest immutable handoff reference: <none or independent handoff path>

## Standing authorization matrix

| Operation | Exact scope | Allowed | Gate/condition | Granted by/date | Notes |
|---|---|---:|---|---|---|
| Local read | <repository or paths> | yes/no | least privilege | | |
| Local write | <paths/subsystem> | yes/no | preserve unrelated changes | | |
| Local automation | <run/scope> | yes/no | clean baseline; local uncommitted candidate only | | no implicit Git/external permission |
| Write run evidence | <private evidence route> | yes/no | sanitize secrets/private data | | |
| Update this control plane | <record> | yes/no | qualifying unresolved state only | | |
| Update development log | <record> | yes/no | substantive changes only | | |
| Append Error Ledger | <private record> | yes/no | qualifying events; append-only | | |
| Create handoff | <private directory> | yes/no | one new immutable file per actual transfer | | |
| Install dependencies | <environment> | yes/no | name packages and reason | | |
| Stage | <files> | yes/no | diff and privacy review | | |
| Commit | <branch> | yes/no | required tests and diff review | | |
| Push | <remote/branch> | yes/no | privacy and acceptance gates | | no force push |
| Open/update PR | <repository> | yes/no | review scope defined | | draft/final |
| Merge | <PR/branch> | yes/no | CI and review gates | | |
| Tag/release | <version/target> | yes/no | artifact identity fixed | | |
| Deploy | <environment> | yes/no | artifact, rollback, health signal | | |
| Production/durable mutation | <target> | no | per-action approval | | |

## Scope claims

### CLAIM-YYYYMMDD-NNN

- Agent/runtime/role: <coordinator / implementer / reviewer / tester / release operator / deployer>
- Claimed at: YYYY-MM-DD HH:mm Z
- Base commit/artifact: <sha / artifact ID / dirty manifest>
- Owned files/subsystem/environment: <exact scope>
- Read-only dependencies: <paths or systems>
- Allowed actions: <exact actions>
- Forbidden actions: <exact actions>
- Expected output: <local candidate / findings / report / artifact>
- Acceptance method: <tests / review / UI path / user acceptance>
- Evidence and reviewer-return channel/owner: <exact destination and owner>
- Error Ledger path/ownership and related ERROR-IDs: <none or exact path/owner/IDs>
- Superseded contracts/paths and permitted adapters: <none or exact list>
- Required negative/anti-bypass evidence: <none or exact proof>
- Stop condition: <where the agent pauses>
- Status: active / complete / withdrawn / transferred
- Completion or independent handoff reference: <evidence path or immutable handoff path>

## Decisions and unresolved questions

### DECISION-YYYYMMDD-NNN — <title>

- Status: proposed / accepted / rejected / superseded
- Author/time:
- Context and evidence:
- Decision and reason:
- Alternatives:
- Consequences/risks:
- Revisit condition:

### QUESTION-YYYYMMDD-NNN — <question>

- Owner:
- Why it matters:
- Evidence needed:
- Blocks: <claim/finding/gate or none>
- Status: open / answered / deferred
- Answer/evidence:

## Findings and dispositions

### FINDING-NNN [P0-P3] <short title>

- Author/time:
- Review baseline: <commit / patch / artifact>
- Affected area:
- Run-evidence reference:
- Evidence and observable impact:
- Requested correction or decision:
- Verification method:
- Disposition: open / fixed / accepted-risk / deferred / not-reproducible / disagreed
- Disposition owner/time/reason:
- Disposition evidence:
- Closed at: <time or blank>

## External gates

### GATE-YYYYMMDD-NNN — <name>

- Required before: <separately authorized next action>
- Required evidence:
- Current evidence references:
- Producer/consumer inventory and unknown count:
- Supersession/anti-bypass evidence:
- Rollback/exit:
- Pass criterion:
- Stop condition:
- Result: pending / passed / failed / withdrawn
- Result owner/time/evidence:

## Control-plane history

Append only qualifying authorization, ownership, decision, finding/disposition, or external-gate changes. Link routine progress, reviews, tests, Error Ledger events, development changes, and handoffs rather than copying them.

### YYYY-MM-DD HH:mm Z — <agent/runtime> — <qualifying control change>

- Base/current identity:
- Authority or claim affected:
- Change and reason:
- Evidence references:
- Related FINDING/GATE/DECISION/ERROR IDs:
- External state:
- Unknowns/risks:
- Next gate and stop condition:
- Independent handoff reference: <none or path>

## Archive index

- <version/date>: <relative path and short description>
