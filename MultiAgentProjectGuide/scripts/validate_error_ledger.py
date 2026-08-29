#!/usr/bin/env python3
"""Read-only structural, history, privacy, and REVIEW checks for Error Ledger v1."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


SCHEMA = "multi-agent-error-ledger/v1"
EVENT_TYPES = {
    "OPENED",
    "DIAGNOSIS",
    "CONTAINMENT",
    "REMEDIATION",
    "VERIFIED",
    "DISPOSITION",
    "RECURRENCE",
    "SUPERSEDED-LINK",
}
CATEGORIES = {"PRODUCT", "HARNESS", "PROVIDER", "TOOL", "UNKNOWN"}
CONFIDENCE = {"confirmed", "strong-inference", "hypothesis", "unknown"}
RUN_CLASSIFICATIONS = {
    "PRODUCT_FAIL",
    "HARNESS_INVALID",
    "VALID_INTERMEDIATE",
    "PROVIDER_OBSERVATION_DRIFT",
    "UNKNOWN_STOP",
}
DISPOSITIONS = {
    "fixed",
    "accepted-risk",
    "deferred",
    "not-reproducible",
    "disagreed",
}
REQUIRED_FIELDS = {
    "Time / timezone",
    "Project / phase / run",
    "Agent / runtime / role",
    "Fixed baseline",
    "Category",
    "Blocking / blocked gate / priority",
    "Evidence confidence",
    "Run classification",
    "Sanitized symptom",
    "Confirmed cause or hypothesis",
    "First relevant error",
    "State changed / unchanged",
    "Containment / remediation / prevention check",
    "Verification actually run",
    "Exact result",
    "Evidence reference / evidence layer",
    "REVIEW reference",
    "Recurrence links",
    "Unknown / unverified",
    "Canonical disposition",
    "Disposition owner / time / reason / scope",
    "Remaining risk / revisit condition",
    "Next owner / action",
    "Pass criterion",
    "Stop condition",
}

ERROR_HEADING = re.compile(r"^## (ERR-\d{8}-\d{3})$")
EVENT_HEADING = re.compile(
    r"^### EVENT (ERR-\d{8}-\d{3}-E(\d{2})) — "
    r"(OPENED|DIAGNOSIS|CONTAINMENT|REMEDIATION|VERIFIED|DISPOSITION|RECURRENCE|SUPERSEDED-LINK)$"
)
FIELD = re.compile(r"^- ([^:]+):\s*(.*)$")
TIMEZONE = re.compile(r"(?:Z|[+-]\d{2}:\d{2})$")
ERROR_ID = re.compile(r"ERR-\d{8}-\d{3}")
PLACEHOLDER = re.compile(r"^\s*(?:<[^>]*>|YYYY(?:-MM-DD.*)?|TBD|TODO)\s*$", re.I)

PRIVACY_PATTERNS = {
    "private key": re.compile(r"BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY", re.I),
    "GitHub token": re.compile(r"\b(?:ghp|github_pat)_[A-Za-z0-9_]{12,}\b"),
    "AWS access key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "credential assignment": re.compile(
        r"\b(?:password|passwd|api[_-]?key|access[_-]?token|secret)\b\s*[:=]\s*"
        r"(?!<redacted>|\[redacted\]|redacted|none)\S+",
        re.I,
    ),
    "Windows absolute path": re.compile(r"(?<![A-Za-z0-9])(?:[A-Za-z]:\\|\\\\)[^\s`]+"),
    "Unix home path": re.compile(r"(?<![A-Za-z0-9])/(?:home|Users)/[^\s`]+"),
    "private endpoint": re.compile(
        r"https?://(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|"
        r"192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)(?::\d+)?",
        re.I,
    ),
    "raw traceback": re.compile(r"Traceback \(most recent call last\):"),
}


@dataclass(frozen=True)
class Event:
    error_id: str
    event_id: str
    sequence: int
    event_type: str
    fields: dict[str, str]
    block: str
    line: int


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8").replace("\r\n", "\n")
    except (OSError, UnicodeError) as exc:
        raise ValueError(f"cannot read UTF-8 file {path}: {exc}") from exc


def missing(value: str | None) -> bool:
    return value is None or not value.strip() or bool(PLACEHOLDER.match(value))


def parse_ledger(text: str) -> tuple[list[str], list[Event], list[str]]:
    errors: list[str] = []
    lines = text.splitlines()
    declared_errors: list[str] = []
    events: list[Event] = []

    schema_match = re.search(r"^- Schema:\s*(\S+)\s*$", text, re.M)
    if not schema_match or schema_match.group(1) != SCHEMA:
        errors.append(f"schema must be exactly {SCHEMA}")
    for header in ("Project", "Private boundary", "Canonical REVIEW record", "Ledger writer"):
        match = re.search(rf"^- {re.escape(header)}:\s*(.*)$", text, re.M)
        if not match or missing(match.group(1)):
            errors.append(f"missing or placeholder ledger header: {header}")

    current_error: str | None = None
    i = 0
    while i < len(lines):
        error_match = ERROR_HEADING.match(lines[i])
        if error_match:
            current_error = error_match.group(1)
            declared_errors.append(current_error)
            i += 1
            continue

        event_match = EVENT_HEADING.match(lines[i])
        if not event_match:
            i += 1
            continue
        if current_error is None:
            errors.append(f"line {i + 1}: event appears before an ERROR heading")
            i += 1
            continue

        event_id, sequence, event_type = event_match.group(1), int(event_match.group(2)), event_match.group(3)
        start = i
        i += 1
        while i < len(lines) and not EVENT_HEADING.match(lines[i]) and not ERROR_HEADING.match(lines[i]):
            i += 1
        block_lines = lines[start:i]
        fields: dict[str, str] = {}
        for offset, line in enumerate(block_lines[1:], start=start + 2):
            field_match = FIELD.match(line)
            if field_match:
                key, value = field_match.group(1).strip(), field_match.group(2).strip()
                if key in fields:
                    errors.append(f"line {offset}: duplicate field {key} in {event_id}")
                fields[key] = value
        events.append(
            Event(
                error_id=current_error,
                event_id=event_id,
                sequence=sequence,
                event_type=event_type,
                fields=fields,
                block="\n".join(block_lines).strip(),
                line=start + 1,
            )
        )

    duplicate_errors = sorted({item for item in declared_errors if declared_errors.count(item) > 1})
    if duplicate_errors:
        errors.append(f"duplicate ERROR headings: {', '.join(duplicate_errors)}")
    duplicate_events = sorted({item.event_id for item in events if sum(e.event_id == item.event_id for e in events) > 1})
    if duplicate_events:
        errors.append(f"duplicate EVENT IDs: {', '.join(duplicate_events)}")

    by_error: dict[str, list[Event]] = {item: [] for item in declared_errors}
    for event in events:
        by_error.setdefault(event.error_id, []).append(event)
    for error_id, members in by_error.items():
        if not members:
            errors.append(f"{error_id} has no events")
            continue
        actual = [item.sequence for item in members]
        expected = list(range(1, len(members) + 1))
        if actual != expected:
            errors.append(f"{error_id} event sequence must be {expected}, got {actual}")
        for event in members:
            if not event.event_id.startswith(f"{error_id}-E"):
                errors.append(f"{event.event_id} does not belong to {error_id}")

    return declared_errors, events, errors


def validate_events(declared_errors: list[str], events: list[Event], allowed_categories: set[str]) -> list[str]:
    errors: list[str] = []
    known_errors = set(declared_errors)
    for event in events:
        missing_fields = sorted(field for field in REQUIRED_FIELDS if missing(event.fields.get(field)))
        if missing_fields:
            errors.append(f"{event.event_id} missing required values: {', '.join(missing_fields)}")

        if event.event_type not in EVENT_TYPES:
            errors.append(f"{event.event_id} has invalid event type {event.event_type}")
        time = event.fields.get("Time / timezone", "")
        if not TIMEZONE.search(time):
            errors.append(f"{event.event_id} time must end with Z or a numeric timezone")
        category = event.fields.get("Category", "")
        if category not in allowed_categories:
            errors.append(f"{event.event_id} invalid category {category}")
        blocking = event.fields.get("Blocking / blocked gate / priority", "").split("/", 1)[0].strip().lower()
        if blocking not in {"yes", "no"}:
            errors.append(f"{event.event_id} blocking must start with yes or no")
        confidence = event.fields.get("Evidence confidence", "")
        if confidence not in CONFIDENCE:
            errors.append(f"{event.event_id} invalid evidence confidence {confidence}")
        run_classification = event.fields.get("Run classification", "")
        if run_classification not in RUN_CLASSIFICATIONS:
            errors.append(f"{event.event_id} invalid run classification {run_classification}")

        disposition = event.fields.get("Canonical disposition", "").lower()
        if disposition != "none" and disposition not in DISPOSITIONS:
            errors.append(f"{event.event_id} invalid canonical disposition {disposition}")
        if disposition == "fixed":
            if event.fields.get("Verification actually run", "").lower() in {"", "none", "not yet"}:
                errors.append(f"{event.event_id} fixed disposition requires verification")
            if event.fields.get("Exact result", "").lower() in {"", "none", "not yet"}:
                errors.append(f"{event.event_id} fixed disposition requires an exact result")
        if disposition == "accepted-risk" and event.fields.get(
            "Disposition owner / time / reason / scope", ""
        ).lower() in {"", "none"}:
            errors.append(f"{event.event_id} accepted-risk requires authorized owner/time/reason/scope")

        recurrence = event.fields.get("Recurrence links", "")
        if recurrence.lower() != "none":
            linked_ids = set(ERROR_ID.findall(recurrence))
            if not linked_ids and not re.search(r"external|history", recurrence, re.I):
                errors.append(f"{event.event_id} recurrence must contain ERROR-ID or external/history marker")
            missing_links = sorted(item for item in linked_ids if item not in known_errors)
            if missing_links and not re.search(r"external|history", recurrence, re.I):
                errors.append(f"{event.event_id} recurrence references missing IDs: {', '.join(missing_links)}")

        if len(event.block.splitlines()) > 80:
            errors.append(f"{event.event_id} is too long for a summary ledger; move raw output to evidence")
    return errors


def validate_privacy(text: str) -> list[str]:
    errors: list[str] = []
    for label, pattern in PRIVACY_PATTERNS.items():
        match = pattern.search(text)
        if match:
            line = text.count("\n", 0, match.start()) + 1
            errors.append(f"line {line}: possible {label}; sanitize and reference private evidence")
    return errors


def validate_private_boundary(ledger: Path, repo_root: Path | None, allow_unchecked: bool) -> list[str]:
    errors: list[str] = []
    if repo_root is None:
        probe = subprocess.run(
            ["git", "-C", str(ledger.parent), "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            check=False,
        )
        if probe.returncode == 0:
            repo_root = Path(probe.stdout.strip())
    if repo_root is None:
        if not allow_unchecked:
            errors.append("private boundary could not be verified; pass --repo-root or --allow-unchecked-private-boundary")
        return errors

    root = repo_root.resolve()
    resolved = ledger.resolve()
    try:
        relative = resolved.relative_to(root)
    except ValueError:
        errors.append(f"ledger is outside repo root {root}; private placement is unverified")
        return errors
    check = subprocess.run(
        ["git", "-C", str(root), "check-ignore", "--quiet", "--", str(relative)],
        capture_output=True,
        text=True,
        check=False,
    )
    if check.returncode != 0:
        errors.append(f"ledger is not ignored by repository policy: {relative}")
    return errors


def validate_history(current_events: list[Event], previous_path: Path | None) -> list[str]:
    if previous_path is None:
        return []
    previous_text = read_text(previous_path)
    _, previous_events, previous_errors = parse_ledger(previous_text)
    errors = [f"previous ledger invalid: {item}" for item in previous_errors]
    current_by_id = {item.event_id: item for item in current_events}
    previous_ids = {item.event_id for item in previous_events}
    previous_unknown_errors = {
        item.error_id
        for item in previous_events
        if item.fields.get("Unknown / unverified", "none").strip().lower() != "none"
    }
    for old in previous_events:
        current = current_by_id.get(old.event_id)
        if current is None:
            errors.append(f"historical event deleted: {old.event_id}")
        elif current.block != old.block:
            errors.append(f"historical event modified: {old.event_id}")
    for new in current_events:
        if new.event_id in previous_ids or new.error_id not in previous_unknown_errors:
            continue
        current_unknown = new.fields.get("Unknown / unverified", "").strip().lower()
        if current_unknown == "none" or "historical" not in current_unknown:
            errors.append(
                f"{new.event_id} must explicitly preserve historical unknown/unverified state for {new.error_id}"
            )
    return errors


def validate_review(events: list[Event], review_path: Path | None) -> list[str]:
    if review_path is None:
        return []
    review = read_text(review_path).lower()
    errors: list[str] = []
    checked: set[tuple[str, str]] = set()
    for event in events:
        disposition = event.fields.get("Canonical disposition", "none").lower()
        key = (event.error_id, disposition)
        if disposition == "none" or key in checked:
            continue
        checked.add(key)
        error_token = event.error_id.lower()
        location = review.find(error_token)
        if location < 0:
            errors.append(f"REVIEW record lacks {event.error_id} for canonical disposition {disposition}")
        else:
            window = review[max(0, location - 500) : location + 2000]
            if disposition not in window:
                errors.append(
                    f"REVIEW record does not contain disposition {disposition} near {event.error_id}"
                )
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("ledger", type=Path)
    parser.add_argument("--previous", type=Path)
    parser.add_argument("--review", type=Path)
    parser.add_argument("--repo-root", type=Path)
    parser.add_argument(
        "--allow-category",
        action="append",
        default=[],
        help="permit an additional project-defined category (repeatable)",
    )
    parser.add_argument("--allow-unchecked-private-boundary", action="store_true")
    args = parser.parse_args()

    try:
        text = read_text(args.ledger)
        declared_errors, events, errors = parse_ledger(text)
        allowed_categories = CATEGORIES | {item.strip() for item in args.allow_category if item.strip()}
        errors.extend(validate_events(declared_errors, events, allowed_categories))
        errors.extend(validate_privacy(text))
        errors.extend(validate_private_boundary(args.ledger, args.repo_root, args.allow_unchecked_private_boundary))
        errors.extend(validate_history(events, args.previous))
        errors.extend(validate_review(events, args.review))
    except ValueError as exc:
        errors = [str(exc)]

    if errors:
        for item in errors:
            print(f"ERROR: {item}")
        print(f"FAIL: {len(errors)} error(s)")
        return 1

    print(f"PASS: {len(declared_errors)} error record(s), {len(events)} event(s)")
    print("Scope: structure and internal consistency only; no product fix, gate, or authorization claim.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
