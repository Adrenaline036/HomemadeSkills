# Error Ledger

- Schema: multi-agent-error-ledger/v1
- Project: <project identifier>
- Private boundary: <ignored private path or policy>
- Canonical REVIEW record: <relative path, or none with the adequate authority source>
- Ledger writer: <agent or role>

Copy this template only when cross-round tracking applies and only to the project's declared private path. Append events; never rewrite an existing event. The v1 compatibility labels `Canonical REVIEW record` and `REVIEW reference` do not require creation of REVIEW: when REVIEW is not applicable, fill them with `none` plus the actual authority/evidence reference. Keep every field name unchanged for validator compatibility.

## ERR-YYYYMMDD-NNN

### EVENT ERR-YYYYMMDD-NNN-E01 — OPENED

- Time / timezone: YYYY-MM-DD HH:mm +08:00
- Project / phase / run: <project / phase / run>
- Agent / runtime / role: <agent / runtime / role>
- Fixed baseline: <commit, artifact, or dirty manifest/fingerprint>
- Category: <PRODUCT / HARNESS / PROVIDER / TOOL / UNKNOWN>
- Blocking / blocked gate / priority: <yes|no / exact gate or none / P0-P3 or none>
- Evidence confidence: <confirmed / strong-inference / hypothesis / unknown>
- Run classification: <PRODUCT_FAIL / HARNESS_INVALID / VALID_INTERMEDIATE / PROVIDER_OBSERVATION_DRIFT / UNKNOWN_STOP>
- Sanitized symptom: <short summary>
- Confirmed cause or hypothesis: <summary and status>
- First relevant error: <sanitized line or evidence anchor>
- State changed / unchanged: <exact summary>
- Containment / remediation / prevention check: <action or none>
- Verification actually run: <command or UI path / not yet>
- Exact result: <result / not yet>
- Evidence reference / evidence layer: <private relative reference / layer>
- REVIEW reference: <claim/finding/decision/gate ID, or none plus authority/evidence reference>
- Recurrence links: <none / ERROR-IDs / external-history marker>
- Unknown / unverified: <items or none>
- Canonical disposition: <none / fixed / accepted-risk / deferred / not-reproducible / disagreed>
- Disposition owner / time / reason / scope: <none or authorized details>
- Remaining risk / revisit condition: <items or none>
- Next owner / action: <owner / action>
- Pass criterion: <observable result>
- Stop condition: <where work pauses>

### EVENT ERR-YYYYMMDD-NNN-E02 — VERIFIED

- Time / timezone: YYYY-MM-DD HH:mm +08:00
- Project / phase / run: <project / phase / run>
- Agent / runtime / role: <agent / runtime / role>
- Fixed baseline: <fixed candidate>
- Category: <PRODUCT / HARNESS / PROVIDER / TOOL / UNKNOWN>
- Blocking / blocked gate / priority: <yes|no / exact gate or none / P0-P3 or none>
- Evidence confidence: <confirmed / strong-inference / hypothesis / unknown>
- Run classification: <PRODUCT_FAIL / HARNESS_INVALID / VALID_INTERMEDIATE / PROVIDER_OBSERVATION_DRIFT / UNKNOWN_STOP>
- Sanitized symptom: <what this event verifies>
- Confirmed cause or hypothesis: <current conclusion>
- First relevant error: <sanitized line or evidence anchor>
- State changed / unchanged: <exact summary>
- Containment / remediation / prevention check: <implemented action>
- Verification actually run: <exact command or UI path>
- Exact result: <exact result>
- Evidence reference / evidence layer: <private relative reference / layer>
- REVIEW reference: <claim/finding/decision/gate ID, or none plus authority/evidence reference>
- Recurrence links: <none / ERROR-IDs / external-history marker>
- Unknown / unverified: <historical unknown preserved and current unknowns>
- Canonical disposition: <none / fixed / accepted-risk / deferred / not-reproducible / disagreed>
- Disposition owner / time / reason / scope: <none or authorized details>
- Remaining risk / revisit condition: <items or none>
- Next owner / action: <owner / action>
- Pass criterion: <observable result>
- Stop condition: <where work pauses>
