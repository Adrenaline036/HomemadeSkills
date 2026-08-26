# Workflow and handoff

Read this reference for multi-stage work, uncertain diagnosis, independent review, cross-agent delegation, finding disposition, checkpoints, context compaction, or runtime handoff.

## Pausable state flow

```text
intake
  -> preflight
  -> claim
  -> diagnosis
  -> implementation
  -> focused_verification
  -> broader_verification
  -> independent_review
  -> finding_disposition
  -> acceptance_gate
  -> handoff_or_complete
```

For high-risk delivery, continue only under explicit gates:

```text
acceptance_gate
  -> release_candidate
  -> artifact_verification
  -> limited_live_gate
  -> user_acceptance
```

The flow may pause or move backward when evidence fails. It is not permission to run every stage automatically.

## Intake, preflight, and claim

At intake, identify the observable outcome, repository/environment and real entrypoint, allowed and forbidden scope, acceptance criteria, required evidence, review checkpoints, and stop condition. Discover safely available facts before asking; ask when the missing answer would materially change the result or authority.

At preflight, inspect project rules, current collaboration state and authorization, relevant development history, Git/worktree state, and necessary live/runtime evidence. Treat paths, commits, runtime capabilities, mounts, services, and old handoffs as drift-prone until verified.

Before writing, create or update a claim with:

- agent/runtime/role and claimed time;
- base commit/artifact or dirty baseline;
- owned files/subsystem/environment and read-only dependencies;
- allowed and forbidden actions;
- expected output and acceptance method;
- superseded contracts/paths, permitted legacy adapters, and required negative evidence when replacing behavior;
- stop condition and status.

Do not begin overlapping writes when another claim owns the same object. Coordinate, become read-only, or isolate the work and designate one integrator.

## Evidence-led diagnosis

For recurring, production, or unclear failures, use:

```text
possible cause -> required evidence -> observed evidence -> conclusion
```

Classify the conclusion:

- `confirmed`: direct evidence proves it;
- `strong inference`: independent evidence converges but direct verification is missing;
- `hypothesis`: plausible and testable but not established;
- `unknown`: current evidence cannot decide.

Inspect logs, real entrypoints, persisted state, state transitions, and runtime behavior before modifying code. “The code appears to do this” is code evidence, not runtime reachability.

## Contract replacement and migration

For a replacement of existing behavior, use: read-only producer/consumer inventory → incident-shaped failing test → canonical path → migrate all callers and consumers → old-path zero or enumerated read-only adapters → disconnect/anti-bypass test → acceptance. Declare the canonical authority and what it supersedes before implementation. Stop while any inventory item is unknown or any legacy path can still produce an accepted or executable state.

## Implementation and verification

- Change only the claimed scope and preserve unrelated work.
- Record a role transition before a reviewer silently becomes an implementer or a tester changes runtime state.
- Give each change an observable verification method; update the development log for substantive implementation or operational change.
- Run focused static and behavioral checks first, then broader regression, container, real-entrypoint, remote, or user gates proportional to risk.
- Record exact command/UI path, shell/host, baseline, time, result/exit code, failed attempts, and uncovered scope.

Evidence levels:

| Level | Supports | Does not support |
|---|---|---|
| `proposal` | A candidate approach exists | It was implemented |
| `code-confirmed` | Code contains named logic | Runtime can reach it |
| `static-confirmed` | Syntax/type/lint gate passed | Functional correctness |
| `focused-test-confirmed` | Named component behavior passed | Full call-chain behavior |
| `local-entrypoint-confirmed` | Real local entry completed the named path | Container or remote behavior |
| `container-confirmed` | Named container/configuration passed | Remote deployment |
| `remote-live-tested` | Named remote environment produced the result | User accepted all scenarios |
| `user-accepted` | User accepted the named scenario and artifact | Permanent absence of regressions |

Bind every evidence claim to `commit/artifact + environment + command/UI path + time + outcome`.

## Independent review and findings

An independent reviewer receives a fixed commit, patch, or artifact; the objective and acceptance criteria; implementation scope and known risks; exact tests/results; unknown/unverified items; review permissions; and stop condition.

The reviewer returns what was actually read and run, the reviewed baseline, reproducible findings, failed attempts, uncovered scope, base drift, and external-state status. “Looks good” without this evidence is incomplete.

Disposition every finding as one of:

```text
fixed
accepted-risk
deferred
not-reproducible
disagreed
```

Record owner, time, reason, and verification evidence. Another model's finding is neither automatically true nor dismissible. Close it only after verification passes or the user explicitly accepts the risk.

## Agent task request

```markdown
## Agent task request

- Project/repository:
- Environment/shell:
- Branch/base commit/artifact:
- Requesting agent:
- Assigned agent/runtime/role:
- Objective:
- Owned/read-only scope:
- Allowed actions:
- Forbidden actions:
- Existing evidence:
- Superseded/legacy paths in scope:
- Anti-bypass evidence required:
- Questions to answer:
- Acceptance method:
- Required return format:
- Sensitive-data boundary:
- Stop condition:
```

## Agent task return

```markdown
## Agent task return

- Agent/runtime/role:
- Baseline actually reviewed:
- Files/resources actually read:
- Commands/UI actions actually run:
- Files/state changed:
- Exact results:
- Producer/consumer inventory and unknown count:
- Remaining bypass/legacy paths:
- Anti-bypass/disconnect results:
- Findings/decisions:
- Failed attempts:
- Unknown/unverified:
- Base drift observed:
- External state changed or unchanged:
- Handoff/next gate:
```

Do not send the whole chat as a handoff. When filesystems differ, prefer: pushed branch plus exact commit; patch plus base commit; sanitized archive plus manifest/hash; then minimum necessary snippets.

## Context management

Keep the main context focused on objective, authority/scope, decisions, concise evidence, findings, and next gate. Move complete logs, repeated stacks, eliminated hypotheses, raw subagent output, unrelated code, and obsolete history into evidence or archive files.

Create a snapshot at a milestone, model/task switch, archive boundary, or before context pressure hides current state:

```markdown
# CONTEXT SNAPSHOT

- Objective:
- Repository/environment:
- Branch/HEAD/upstream:
- Dirty/staged/untracked state:
- Active role and claims:
- Authorization relied upon:
- Completed work:
- Decisions and reasons:
- Files changed:
- Tests and exact results:
- Failed attempts:
- Confirmed facts:
- Inferences/hypotheses:
- Unknown/unverified:
- Open findings/blockers:
- External state:
- Evidence paths:
- Rollback:
- Next action:
- Pass criterion:
- Stop condition:
```

A snapshot is navigation, not proof. A resumed agent must recheck Git and any necessary runtime state.

## Parallel-agent boundaries

- Prefer parallel read-heavy, independent, bounded exploration, testing, triage, or summarization.
- Parallel write-heavy work requires non-overlapping ownership or isolated worktrees/branches.
- Do not assign multiple agents the same small task or return their raw intermediate noise to the coordinator.
- Ask returning agents for conclusions, evidence, failures, unknowns, and base drift.
- Do not spawn agents solely because a multi-agent Skill is active.

## Runtime adapters

Maintain one canonical Skill package. A runtime adapter changes only how that package is loaded, not its collaboration contract.

- TRAE: install the complete canonical package into the project's Agent Skills location with `scripts/install-trae-project-skill.ps1`, reload TRAE, and verify discovery in its Skills settings. Use project Rules only as a bootstrap to load this canonical package.
- Deep Code: when supported by the installed runtime, use its Agent Skills locations such as a user `~/.agents/skills/<name>/SKILL.md` or project `.deepcode/skills/<name>/SKILL.md`; verify the current runtime rather than assuming paths from prose.
- DeepSeek chat/API or another runtime without a verified native Skill mechanism: provide the sanitized canonical package or its relevant rules through the runtime's supported project-rule, system-prompt, or file-context mechanism. State that this is an adapter, verify that the agent actually loaded it, and never assume access to local records or credentials.

For every runtime, hand off the same base, role/scope, authority, evidence, sensitive-data boundary, return schema, and stop condition.

## Acceptance gates and stop conditions

Before advancing, confirm the evidence belongs to the claimed layer, tests bind to the current baseline, blocking findings are disposed, external state matches the record, rollback or non-destructive exit exists, and authorization covers the next action.

Stop before the next gate when:

- authority does not cover an external or destructive action;
- overlapping ownership is unresolved;
- target path or environment cannot be identified exactly;
- critical evidence is missing before durable mutation;
- reviewed baseline differs from the current commit/artifact;
- a blocking finding remains open;
- rollback or exit is absent;
- privacy boundaries cannot be satisfied;
- live counterevidence invalidates the candidate.
- a producer/consumer inventory contains unknown items;
- a superseded path or alternate writer can still reach an accepted state;
- real-entry tests still pass after the canonical authority is disconnected.

Complete safe read-only checks, record the evidence and minimum recovery input, and do not claim blockage merely because the task is difficult.

## Git, CI, release, deployment, and handoff

Record stage, commit, push, PR, merge, tag, artifact publication, release, deploy, and destructive change separately. Review the staged diff and privacy before publication; preserve unrelated work; do not force-push by default.

CI status is exactly one of `passed`, `failed`, `queued`, `in_progress`, `cancelled`, `skipped`, `timed_out`, or `not_run`. Only `passed` tied to the current commit is passing evidence.

For release/deployment, identify source commit, artifact/hash, configuration source, target, privacy result, rollback artifact/command, and acceptance signal. Report deployment state separately as `uploaded`, `started`, `healthy`, `functionally_tested`, and `user_accepted`.

A complete handoff includes changed and unchanged state, baseline/current identity, dirty state, role/scope, exact actions/results, failures, evidence levels, findings/dispositions, unknowns, external state, authorization, rollback, next owner/action, pass criterion, and stop condition.
