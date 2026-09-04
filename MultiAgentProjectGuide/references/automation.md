# Automated DeepSeek review

Read this reference before using the automated Codex writer -> test -> DeepSeek review -> fix loop. It produces an unstaged local candidate. It does not authorize Git publication, release, deployment, production access, durable-data mutation, or secret handling beyond the configured launcher.

## Default contract

- Codex is the sole implementation writer.
- DeepSeek V4 Flash is a separate implementation-read-only reviewer.
- V4 Pro is never an automatic fallback. Use it only when Flash is demonstrably inadequate and the user explicitly authorizes that individual review.
- Continue automatically through already-authorized local implementation, test, review, fix, retest, and re-review gates. Stop selectively for a real blocker or an external boundary.
- Default to at most two candidate reviews in one fix loop unless the parent authorization declares another finite limit. Every Provider request is explicit and separately counted; the adapter never retries.
- Record Provider usage but impose no token-cost stop unless the user selects a concrete cost ceiling.

Use manual orchestration when the baseline or scope cannot be fixed, tests are unknown, the worktree state cannot be isolated, privacy screening fails, the configured MCP or credential is unavailable, or the work crosses a live/high-risk boundary.

## Thin MCP adapter

The verified Codex adapter is the user-scoped MCP server "deepseekReview". A cache generation is identified by the model plus the exact serialized system-contract/stable-context prefix. A review gate, delivery version, task, or Codex/TRAE conversation does not create a new generation by itself. Changing the system contract, message order, serializer, model, or stable-context bytes does. It exposes two purpose-built tools:

- "warm_review_context": first evaluates the planned initial package locally, then sends one stable project context only when its persistent registry has no active record for that exact generation. A later call from another gate, version, conversation, or MCP process returns `CACHE_WARMUP_REUSED` with Provider requests `0`.
- "review_candidate": appends one dynamic candidate package and performs one external review.

The MCP server, not the calling agent, constructs the Provider messages in this fixed order:

1. a versioned system review contract;
2. the adapter's fixed general obligation catalog;
3. the caller's byte-identical stable project context; and
4. the current dynamic review package plus only the caller's task-specific obligation list.

The fixed general obligations belong before the project context so correctness, safety, compatibility, data-integrity, and authority-bypass rules are cached once instead of resent in every dynamic suffix. The local validator still combines those fixed obligations with the task-specific list, so moving them does not weaken finding/unknown binding.

Do not recreate this transport with a generic chat tool, concatenate the messages, or maintain a project-specific serializer. The old request-plan compiler, review-artifact manifest, LOAD ACK schema, patched third-party MCP package, and direct REST/PowerShell harness are retired paths, not fallbacks.

### Stable context

Include only privacy-screened material that remains authoritative across the expected review rounds:

- project rules and acceptance contracts;
- relevant architecture and public interfaces;
- unchanged source or test context needed to understand the candidate; and
- stable error and compatibility semantics.

Exclude timestamps, conversation/task/request/package IDs, delivery version, current baseline or candidate hashes, the current diff or changed implementation, changing test output, prior review returns, logs, and unrelated padding. Keep one deterministic project-level stable-context artifact or assembly order so a new agent process recreates identical bytes. If any stable content changes, treat it as a new generation and warm it once before the next review. Never add candidate content or irrelevant text merely to raise the cache ratio.

### Dynamic review package

Include the unique package ID, fixed baseline and candidate identity, review objective, minimum complete diff or changed code, relevant test evidence, and any current failure or finding disposition. Supply one or more explicit obligations as stable IDs with precise clauses; these are the only requirements to which a finding or unknown may bind. Do not ask the model to invent additional requirements or meet a finding quota. Keep the dynamic package small enough that the adapter's predicted stable-prefix ratio passes. Split a large change into coherent review scopes instead of truncating evidence.

Before either tool call, confirm "privacy_screened: true" only after excluding credentials, .env content, cookies, tokens, private endpoints, personal data, databases, full private logs, deployment artifacts, media inventories, and unrelated changes. The first `warm_review_context` call must also carry `planned_package_id`, `planned_review_package`, and `planned_obligations`; those values are used only for local size/obligation preflight and are not sent in the warm request.

## Cache acceptance and accounting

DeepSeek cache reuse is best effort, but the local cacheable-review contract has measurable gates:

- the adapter rejects the first planned candidate locally before any warm billing when the byte-based predicted stable-prefix ratio is below 90%; later candidates receive the same preflight;
- the first request for a genuinely new stable generation is the explicit cold "warm_review_context" call; the registry stores only hashes, model, timestamps, sanitized response identity, usage totals, and state outside project/Git content, never the stable text, dynamic package, or credential;
- an active registry record suppresses duplicate warm requests across gates, delivery versions, conversations, and fresh MCP processes; a concurrent warm reservation also fails locally rather than spending twice;
- each following "review_candidate" call should report at least 85% cache-hit input tokens;
- accept cache evidence only from Provider-returned "prompt_cache_hit_tokens" and "prompt_cache_miss_tokens";
- require prompt tokens = hit + miss and total tokens = prompt + completion; and
- retain response ID, model, finish reason, stable-prefix hash, per-request usage, generation aggregate usage, Provider/local-reuse request counts, and zero-retry count in run evidence.

A below-target hit rate is a cost-path failure, not proof that an otherwise valid review is wrong. Preserve the review, mark the generation stale, and stop before another billable review to diagnose prefix drift, cache expiry, or an unwarmed generation. A later authorized gate may warm the stale generation once; do not resend the already-completed candidate merely to improve its ratio. Do not resend solely because the Provider dashboard has not refreshed; dashboard accounting may lag the API response.

Report two ratios separately. The formal-review ratio is `review hit / review prompt` and remains the `>=85%` gate. The amortized generation ratio is `all generation hit / all generation prompt`, including the one cold warm; it will be about 50% for one warm plus one review even when the formal review is nearly perfect. Do not create extra reviews to raise the aggregate. Improve it by reusing the same generation across real gates and delivery versions.

When the Provider, model, MCP serializer, system contract, generation registry, semantic validator, or credential changes, run a separately authorized synthetic acceptance. Use one cold warm and several realistic packages spanning architecture/Phase 0, RED, flawed GREEN, corrected GREEN, final review, and at least one later delivery version. Start every tool call in a fresh MCP process to simulate separate conversations; deliberately call `warm_review_context` again at selected boundaries and require `CACHE_WARMUP_REUSED`, Provider requests `0`, and an unchanged prefix hash. Require valid structured returns, unique Provider response IDs, usage closure, exactly one obligation-bound finding for a seeded single defect, clean post-fix/final PASS results, zero implicit retries, at least 85% hit ratio on every formal post-warm package, and at least 85% amortized generation hit after the realistic multi-gate sequence without artificial review traffic. Before spending Provider requests, replay retained sanitized bad-response fixtures and require local rejection.

## Minimal review return

The adapter requests and locally validates one compact JSON object:

- exact package_id;
- verdict as PASS or FAIL;
- zero to eight unique P0-P2 findings, each with a supplied obligation_id, unique root_cause_key, file/section, line when available, concrete counterexample, evidence, impact, and corrective direction;
- structured unknowns, each bound to a supplied obligation_id; and
- a concise summary.

PASS requires empty findings and unknowns. FAIL requires at least one finding or unknown. Structural validation checks the schema, package identity, enum and verdict relationships. Semantic validation rejects unsupplied obligation IDs, duplicate root causes, no-op or invented-requirement findings, contradiction/no-defect language, and narration about searching for findings. Empty content, non-JSON output, package mismatch, non-stop finish, invalid usage, or either validation failure is an invalid review. HTTP 200, consumed tokens, nonempty text, and schema-valid JSON alone never mean approval.

Preserve the machine classification. `REVIEW_STRUCTURAL_INVALID` and `REVIEW_SEMANTIC_INVALID` are harness-invalidating STOP states, not FAIL verdicts and not evidence that the product is defective. `CACHE_BELOW_TARGET` is a cost-path STOP with the review content preserved. A normal `FINDINGS` result remains untrusted until the coordinator reproduces it; a normal `PASS` closes only the supplied obligations for the fixed candidate and evidence layer.

Do not require the reviewer to echo every rule file, baseline field, test name, or permission in a LOAD ACK. The coordinator already owns those identities and binds the saved return to the candidate manifest. A high-risk project may supply more focused obligations and may add project-specific post-validation, but it must not fork the MCP transport or enlarge every ordinary review.

Treat reviewer findings as untrusted evidence. The coordinator reproduces and dispositions them; the reviewer never writes the fix. If every finding is dispositioned `disagreed`, a high-risk independent-review gate remains open until the same fixed candidate receives a separate valid external PASS or the user explicitly accepts the risk. Never spend a V4 Pro request automatically to settle disagreement.

## Credential and first use

The verified Windows launcher uses one DPAPI-protected credential container as its only authority. Environment variables, .env files, alternate paths, and retired keys are not fallbacks. Never ask the user to paste an API key into chat or place it in commands, evidence, logs, prompts, or Git.

If activation is missing, the user runs the established local helper:

    $reviewPwsh = (Get-Command pwsh.exe -ErrorAction SilentlyContinue).Source
    if (-not $reviewPwsh) {
        $reviewPwsh = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe'
    }
    if (-not (Test-Path -LiteralPath $reviewPwsh -PathType Leaf)) { throw 'PowerShell 7 was not found.' }
    & $reviewPwsh -NoProfile -File "$env:USERPROFILE\.codex\automation\codex-deepseek-review\Set-CodexDeepSeekCredential.ps1"

Verify only that the container exists, has the expected credential type, and decrypts to a nonempty value. Never print, hash, compare, or retain the secret.

## Automated loop

1. Freeze repository, branch, HEAD or dirty manifest, allowed paths, candidate identity method, tests, evidence path, review-round limit, privacy exclusions, and final human boundary.
2. Codex implements the smallest coherent change and runs the declared tests.
3. Build the deterministic minimum project-level stable context and the first planned dynamic package. Call `warm_review_context` with both: it performs local candidate preflight first, then either cold-warms a new generation once or returns a zero-request registry reuse result. A new conversation, review gate, or delivery version alone never justifies another Provider warm.
4. Build the dynamic package, declare its explicit obligation IDs/clauses, and call "review_candidate".
5. Require structural validity, semantic validity, exact obligation binding, closed usage, and fixed-candidate binding. Reproduce every blocking finding.
6. If a finding is valid and in scope, Codex fixes it, reruns all required tests, and re-reviews with the same stable generation when it remains authoritative. Candidate code, evidence, and finding disposition stay dynamic.
7. Complete at the local candidate boundary when tests pass and the reviewer returns valid PASS. Stop when the finite round limit is exhausted or a selective-stop predicate applies.

Stop for scope/base drift, privacy failure, missing credential/runtime, structural or semantic review invalidity, below-target expected cache reuse, failed required tests, unresolved blocking findings or unknowns, high-risk all-disagreed review without a valid external PASS, human judgment, or any unapproved Git/live/production/durable/destructive boundary. A clean local gate otherwise continues automatically.

## Evidence and records

Keep a small run manifest containing the fixed candidate identity, allowed scope, exact tests, privacy result, stable-prefix hash, dynamic package hash, tool results, finding dispositions, and final state. Store structured returns and sanitized Provider metadata in run evidence. Never retain chain-of-thought or raw secrets.

Write substantive implementation or harness changes to the established development log. Use the Error Ledger only for qualifying cross-round or safety-relevant failures. REVIEW.md remains conditional, and an in-run external review is not a handoff.
