# Project collaboration review

## Current state

- Updated: YYYY-MM-DD HH:mm Z
- Coordinator/agent/runtime: <name / runtime>
- Repository/environment: <absolute path / host / shell>
- Branch / HEAD / upstream: <branch / sha / upstream>
- Dirty, staged, and untracked state: <clean or exact files>
- Objective: <one observable outcome>
- Interaction record path and writer: <path / agent or role>
- Error Ledger path and writer: <none or path / agent or role>
- Current related ERROR-IDs: <none or IDs>
- Active roles and claims: <CLAIM IDs>
- Verified evidence: <evidence layer and exact result>
- Failed attempts: <summary or none>
- Unknown/unverified: <items or none>
- Open findings/blockers: <FINDING IDs or none>
- External state: <changed / deliberately unchanged / unknown>
- Next acceptance gate: <action, expected result, pass criterion, stop condition>

## Standing authorization matrix

| Operation | Exact scope | Allowed | Gate/condition | Granted by/date | Notes |
|---|---|---:|---|---|---|
| Local read | <repository or paths> | yes/no | least privilege | | |
| Local write | <paths/subsystem> | yes/no | preserve unrelated changes | | |
| Update REVIEW.md | <private record> | yes/no | preserve history | | |
| Update development log | <record> | yes/no | substantive changes only | | |
| Install dependencies | <environment> | yes/no | name packages and reason | | |
| Stage | <files> | yes/no | diff and privacy review | | |
| Commit | <branch> | yes/no | required tests and diff review | | |
| Push | <remote/branch> | yes/no | privacy and acceptance gates | | no force push |
| Open/update PR | <repository> | yes/no | review scope defined | | draft/final |
| Merge | <PR/branch> | yes/no | CI and review gates | | |
| Tag/release | <version/target> | yes/no | artifact identity fixed | | |
| Deploy | <environment> | yes/no | artifact, rollback, health signal | | |
| Destructive data change | <target> | no | per-action approval | | |

## Scope claims

### CLAIM-YYYYMMDD-NNN

- Agent/runtime/role: <coordinator / implementer / reviewer / tester / release operator / deployer>
- Claimed at: YYYY-MM-DD HH:mm Z
- Base commit/artifact: <sha / artifact ID / dirty baseline>
- Owned files/subsystem/environment: <exact scope>
- Read-only dependencies: <paths or systems>
- Allowed actions: <exact actions>
- Forbidden actions: <exact actions>
- Expected output: <commit / patch / findings / report / artifact>
- Acceptance method: <tests / review / UI path / user acceptance>
- Review output path/channel and record owner: <not applicable or exact destination and owner>
- Discussion-persistence trigger and interaction-record owner: <exact rule and owner>
- Error Ledger path/ownership and related ERROR-IDs: <none or exact path/owner/IDs>
- Superseded contracts/paths and allowed adapters: <none or exact list>
- Required negative/anti-bypass evidence: <none or exact proof>
- Stop condition: <where the agent must pause>
- Status: active / handed-off / complete / withdrawn
- Completion/handoff evidence: <when status changes>

## Decisions and open questions

### DECISION-YYYYMMDD-NNN — <title>

- Status: proposed / accepted / rejected / superseded
- Author/time:
- Context:
- Evidence:
- Decision and reason:
- Alternatives considered:
- Consequences/risks:
- Revisit condition:

### QUESTION-YYYYMMDD-NNN — <question>

- Owner:
- Why it matters:
- Evidence needed:
- Blocks: <claim/finding/gate or none>
- Status: open / answered / deferred
- Answer/evidence:

## Review findings and dispositions

### FINDING-NNN [P0-P3] <short title>

- Author/time:
- Review baseline: <commit / patch / artifact>
- Affected area: <file/function/system/environment>
- Evidence: <reproducible evidence, file/line, command, or evidence path>
- Impact: <observable consequence>
- Requested change: <specific correction or decision>
- Verification method: <how to prove disposition>
- Disposition: open / fixed / accepted-risk / deferred / not-reproducible / disagreed
- Disposition owner/time:
- Disposition evidence: <command/result/commit/user decision>
- Closed at: <time or blank>

## Checkpoints and acceptance gates

### GATE-YYYYMMDD-NNN — <name>

- Required before: <next action>
- Required evidence:
- Current evidence:
- Producer/consumer inventory and unknown count:
- Supersession/anti-bypass evidence:
- Pass criterion:
- Stop condition:
- Result: pending / passed / failed / withdrawn
- Result owner/time:
- Result evidence:

## Session history

### YYYY-MM-DD HH:mm Z — <agent/runtime> — <role>

- Base/current commit or artifact:
- Claim IDs:
- Scope performed:
- Files changed:
- Commands/UI actions and exact results:
- Failed/flaky attempts:
- Confirmed facts:
- Superseded/remaining legacy paths:
- Inferences/hypotheses:
- Unknown/unverified:
- Findings opened/updated/closed:
- Development-guiding discussion captured: <record reference / none>
- Error Ledger events appended or proposed: <ERROR-ID/EVENT-ID / none>
- Review return persisted or acknowledged: <record path / recipient / evidence / not applicable>
- External state changed or deliberately unchanged:
- Authorization relied upon:
- Decisions and risks:
- Rollback/recovery note:
- Handoff/next gate:

## Archive index

- <version/date>: <relative path and short description>
