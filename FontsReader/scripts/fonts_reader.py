#!/usr/bin/env python3
"""Read-only ASS/SSA font audit and conservative per-series collection."""

from __future__ import annotations

import argparse
import csv
import hashlib
import os
import re
import shutil
import sys
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable

try:
    from fontTools.ttLib import TTCollection, TTFont
except ImportError as exc:  # pragma: no cover - exercised by dependency check
    raise SystemExit(
        "FontsReader requires fonttools. Install it with: "
        f"{sys.executable} -m pip install fonttools"
    ) from exc


SUBTITLE_EXTENSIONS = {".ass", ".ssa"}
FONT_EXTENSIONS = {".ttf", ".otf", ".ttc", ".otc"}
INLINE_FONT_RE = re.compile(r"\\fn([^\\})]+?)(?=\\|\)|})", re.IGNORECASE)
INVALID_FILENAME_RE = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


@dataclass(frozen=True, order=True)
class FontRequest:
    normalized_name: str
    display_name: str
    bold: bool
    italic: bool


@dataclass(frozen=True)
class FontCandidate:
    path: Path
    face_index: int
    names: frozenset[str]
    primary_names: frozenset[str]
    strong_names: frozenset[str]
    bold: bool
    italic: bool
    is_system: bool


@dataclass
class ParseResult:
    inventory_rows: list[dict[str, object]]
    requests: dict[tuple[str, bool, bool], FontRequest]
    subtitle_count: int
    decode_errors: int
    snapshots: dict[Path, tuple[int, int]]


def normalize_name(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).strip().split()).casefold()


def safe_filename(value: str) -> str:
    cleaned = INVALID_FILENAME_RE.sub("_", value).strip(" .")
    return cleaned or "series"


def parse_ass_bool(value: str) -> bool:
    try:
        return int(float(value.strip())) != 0
    except ValueError:
        return value.strip().casefold() in {"true", "yes", "bold", "italic"}


def decode_subtitle(path: Path) -> tuple[str, str]:
    data = path.read_bytes()
    if data.startswith((b"\xff\xfe", b"\xfe\xff")):
        return data.decode("utf-16"), "utf-16"
    if data.startswith(b"\xef\xbb\xbf"):
        return data.decode("utf-8-sig"), "utf-8-sig"

    candidates = ["utf-8"]
    if data[:4096].count(b"\x00") > max(4, len(data[:4096]) // 10):
        candidates.extend(["utf-16-le", "utf-16-be"])
    candidates.extend(["gb18030", "cp932", "big5", "windows-1252"])
    failures: list[str] = []
    for encoding in candidates:
        try:
            return data.decode(encoding), encoding
        except UnicodeDecodeError as exc:
            failures.append(f"{encoding}@{exc.start}")
    raise UnicodeDecodeError("unknown", data, 0, min(1, len(data)), "; ".join(failures))


def split_ass_record(payload: str, field_count: int) -> list[str]:
    return [part.strip() for part in payload.split(",", max(0, field_count - 1))]


def resolve_style(reference: str, styles: dict[str, dict[str, str]]) -> tuple[str | None, str]:
    if reference in styles:
        return reference, ""
    if reference.startswith("*") and reference[1:] in styles:
        return reference[1:], f"legacy style reference {reference} -> {reference[1:]}"
    folded = [name for name in styles if name.casefold() == reference.casefold()]
    if len(folded) == 1:
        return folded[0], f"case-normalized style reference {reference} -> {folded[0]}"
    return None, f"undefined or ambiguous style: {reference}"


def add_request(
    requests: dict[tuple[str, bool, bool], FontRequest],
    font_name: str,
    bold: bool,
    italic: bool,
) -> FontRequest | None:
    display = " ".join(font_name.strip().split())
    normalized = normalize_name(display)
    if not normalized:
        return None
    key = (normalized, bold, italic)
    request = requests.get(key)
    if request is None:
        request = FontRequest(normalized, display, bold, italic)
        requests[key] = request
    return request


def parse_subtitle(path: Path, series_root: Path) -> tuple[list[dict[str, object]], dict[tuple[str, bool, bool], FontRequest]]:
    text, encoding = decode_subtitle(path)
    section = ""
    style_format: list[str] = []
    event_format: list[str] = []
    styles: dict[str, dict[str, str]] = {}
    events: list[dict[str, str]] = []

    for raw_line in text.splitlines():
        line = raw_line.strip("\ufeff\r\n")
        stripped = line.strip()
        if stripped.startswith("[") and stripped.endswith("]"):
            section = stripped.casefold()
            continue
        if ":" not in line:
            continue
        prefix, payload = line.split(":", 1)
        key = prefix.strip().casefold()
        if section in {"[v4+ styles]", "[v4 styles]"}:
            if key == "format":
                style_format = [field.strip().casefold() for field in payload.split(",")]
            elif key == "style" and style_format:
                values = split_ass_record(payload, len(style_format))
                if len(values) == len(style_format):
                    row = dict(zip(style_format, values))
                    if row.get("name"):
                        styles[row["name"]] = row
        elif section == "[events]":
            if key == "format":
                event_format = [field.strip().casefold() for field in payload.split(",")]
            elif key in {"dialogue", "comment"} and event_format:
                values = split_ass_record(payload, len(event_format))
                if len(values) == len(event_format):
                    row = dict(zip(event_format, values))
                    row["_event_type"] = key
                    events.append(row)

    relative = path.relative_to(series_root).as_posix()
    requests: dict[tuple[str, bool, bool], FontRequest] = {}
    usage: dict[tuple[str, bool, bool, str, bool, str], int] = defaultdict(int)

    for event in events:
        if event.get("_event_type") != "dialogue":
            continue
        style_reference = event.get("style", "Default")
        style_name, style_note = resolve_style(style_reference, styles)
        style = styles.get(style_name or "", {})
        bold = parse_ass_bool(style.get("bold", "0"))
        italic = parse_ass_bool(style.get("italic", "0"))
        font_name = style.get("fontname", "")
        request = add_request(requests, font_name, bold, italic)
        if request:
            usage[(request.normalized_name, bold, italic, style_reference, False, style_note)] += 1

        for inline_name in INLINE_FONT_RE.findall(event.get("text", "")):
            inline_request = add_request(requests, inline_name, bold, italic)
            if inline_request:
                usage[(inline_request.normalized_name, bold, italic, style_reference, True, "inline \\fn override")] += 1

    rows: list[dict[str, object]] = []
    for (normalized, bold, italic, style_name, inline, note), count in sorted(usage.items()):
        request = requests[(normalized, bold, italic)]
        rows.append(
            {
                "subtitle": relative,
                "encoding": encoding,
                "style": style_name,
                "requested_font": request.display_name,
                "bold": int(bold),
                "italic": int(italic),
                "inline_override": int(inline),
                "dialogue_events": count,
                "note": note,
            }
        )
    return rows, requests


def parse_series(series_root: Path) -> ParseResult:
    subtitle_paths = sorted(
        path for path in series_root.rglob("*") if path.is_file() and path.suffix.casefold() in SUBTITLE_EXTENSIONS
    )
    inventory_rows: list[dict[str, object]] = []
    requests: dict[tuple[str, bool, bool], FontRequest] = {}
    decode_errors = 0
    snapshots: dict[Path, tuple[int, int]] = {}
    for path in subtitle_paths:
        stat = path.stat()
        snapshots[path] = (stat.st_size, stat.st_mtime_ns)
        try:
            rows, parsed_requests = parse_subtitle(path, series_root)
            inventory_rows.extend(rows)
            requests.update(parsed_requests)
        except (OSError, UnicodeError) as exc:
            decode_errors += 1
            inventory_rows.append(
                {
                    "subtitle": path.relative_to(series_root).as_posix(),
                    "encoding": "error",
                    "style": "",
                    "requested_font": "",
                    "bold": "",
                    "italic": "",
                    "inline_override": "",
                    "dialogue_events": "",
                    "note": f"decode/read error: {exc}",
                }
            )
    return ParseResult(inventory_rows, requests, len(subtitle_paths), decode_errors, snapshots)


def font_names(font: TTFont) -> tuple[frozenset[str], frozenset[str], frozenset[str]]:
    values: set[str] = set()
    primary: set[str] = set()
    strong: set[str] = set()
    name_table = font.get("name")
    if name_table is None:
        return frozenset(), frozenset(), frozenset()
    for record in name_table.names:
        if record.nameID not in {1, 2, 4, 6, 16, 17, 21, 22}:
            continue
        try:
            value = normalize_name(record.toUnicode())
        except (UnicodeDecodeError, AttributeError):
            continue
        if value:
            values.add(value)
            if record.nameID == 1:
                primary.add(value)
            if record.nameID in {4, 6}:
                strong.add(value)
    return frozenset(values), frozenset(primary), frozenset(strong)


def font_style(font: TTFont) -> tuple[bool, bool]:
    bold = False
    italic = False
    os2 = font.get("OS/2")
    if os2 is not None:
        bold = getattr(os2, "usWeightClass", 400) >= 700 or bool(getattr(os2, "fsSelection", 0) & (1 << 5))
        italic = bool(getattr(os2, "fsSelection", 0) & 1)
    head = font.get("head")
    if head is not None:
        bold = bold or bool(getattr(head, "macStyle", 0) & 1)
        italic = italic or bool(getattr(head, "macStyle", 0) & 2)
    post = font.get("post")
    if post is not None:
        italic = italic or bool(getattr(post, "italicAngle", 0))
    return bold, italic


def iter_font_candidates(path: Path, is_system: bool) -> Iterable[FontCandidate]:
    suffix = path.suffix.casefold()
    try:
        if suffix in {".ttc", ".otc"}:
            collection = TTCollection(str(path), lazy=True)
            try:
                for index, font in enumerate(collection.fonts):
                    names, primary_names, strong_names = font_names(font)
                    if names:
                        bold, italic = font_style(font)
                        yield FontCandidate(path, index, names, primary_names, strong_names, bold, italic, is_system)
            finally:
                collection.close()
        else:
            font = TTFont(str(path), lazy=True)
            try:
                names, primary_names, strong_names = font_names(font)
                if names:
                    bold, italic = font_style(font)
                    yield FontCandidate(path, 0, names, primary_names, strong_names, bold, italic, is_system)
            finally:
                font.close()
    except Exception as exc:  # malformed third-party font: report and continue
        print(f"warning: skipped unreadable font {path}: {exc}", file=sys.stderr)


def discover_font_files(roots: list[tuple[Path, bool]]) -> list[tuple[Path, bool]]:
    discovered: dict[str, tuple[Path, bool]] = {}
    for root, is_system in roots:
        for path in root.rglob("*"):
            if path.is_file() and path.suffix.casefold() in FONT_EXTENSIONS:
                key = os.path.normcase(str(path.resolve()))
                discovered.setdefault(key, (path, is_system))
    return sorted(discovered.values(), key=lambda item: str(item[0]).casefold())


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def match_request(request: FontRequest, candidates: list[FontCandidate], hashes: dict[Path, str]) -> tuple[str, list[FontCandidate], str]:
    exact = [candidate for candidate in candidates if request.normalized_name in candidate.names]
    if not exact:
        return "missing", [], "no exact internal-name match"
    primary = [candidate for candidate in exact if request.normalized_name in candidate.primary_names]
    strong = [candidate for candidate in exact if request.normalized_name in candidate.strong_names]
    tiers = [
        [candidate for candidate in primary if candidate.bold == request.bold and candidate.italic == request.italic],
        [candidate for candidate in strong if candidate.bold == request.bold and candidate.italic == request.italic],
        [candidate for candidate in exact if candidate.bold == request.bold and candidate.italic == request.italic],
        primary,
        strong,
        exact,
    ]
    pool = next(tier for tier in tiers if tier)
    unique_faces = {(candidate.path, candidate.face_index): candidate for candidate in pool}
    pool = list(unique_faces.values())
    unique_paths = {candidate.path for candidate in pool}
    if len(unique_paths) == 1:
        style_exact = all(candidate.bold == request.bold and candidate.italic == request.italic for candidate in pool)
        note = "exact internal-name and face-style match" if style_exact else "single exact internal-name file; renderer may synthesize style"
        return "matched", pool, note
    digest_groups: dict[str, list[FontCandidate]] = defaultdict(list)
    for candidate in pool:
        hashes.setdefault(candidate.path, sha256(candidate.path))
        digest_groups[hashes[candidate.path]].append(candidate)
    if len(digest_groups) == 1:
        chosen = min(pool, key=lambda candidate: str(candidate.path).casefold())
        return "matched", [chosen], "duplicate exact files had identical SHA-256"
    return "ambiguous", [], f"{len(unique_paths)} different exact files require review"


def unique_output_dir(output_root: Path, series_name: str, mode: str, stamp: str) -> Path:
    suffix = f"-subtitle-fonts-{'audit-' if mode == 'audit' else ''}{stamp}"
    base = output_root / f"{safe_filename(series_name)}{suffix}"
    candidate = base
    counter = 2
    while candidate.exists():
        candidate = Path(f"{base}-{counter}")
        counter += 1
    candidate.mkdir(parents=True)
    return candidate


def copy_unique(source: Path, destination_dir: Path, hashes: dict[Path, str]) -> Path:
    destination_dir.mkdir(parents=True, exist_ok=True)
    hashes.setdefault(source, sha256(source))
    destination = destination_dir / source.name
    if destination.exists():
        if sha256(destination) == hashes[source]:
            return destination
        destination = destination_dir / f"{source.stem}-{hashes[source][:8]}{source.suffix}"
        if destination.exists() and sha256(destination) != hashes[source]:
            raise FileExistsError(f"unresolved output collision: {destination}")
    if not destination.exists():
        shutil.copy2(source, destination)
    return destination


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, object]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def is_relative_to(path: Path, other: Path) -> bool:
    try:
        path.relative_to(other)
        return True
    except ValueError:
        return False


def process_series(
    series_root: Path,
    output_root: Path,
    font_roots: list[tuple[Path, bool]],
    mode: str,
    archive_system_fonts: bool,
    stamp: str,
) -> dict[str, object]:
    parsed = parse_series(series_root)
    roots = [(series_root, False), *font_roots]
    files = discover_font_files(roots)
    candidates: list[FontCandidate] = []
    for path, is_system in files:
        candidates.extend(iter_font_candidates(path, is_system))

    hashes: dict[Path, str] = {}
    results: list[tuple[FontRequest, str, list[FontCandidate], str]] = []
    for request in sorted(parsed.requests.values()):
        status, matches, note = match_request(request, candidates, hashes)
        results.append((request, status, matches, note))

    output_dir = unique_output_dir(output_root, series_root.name, mode, stamp)
    fonts_dir = output_dir / "Fonts"
    fonts_dir.mkdir()
    packaged_names: dict[Path, str] = {}
    if mode == "collect":
        for _, status, matches, _ in results:
            if status != "matched":
                continue
            for candidate in matches:
                copied = copy_unique(candidate.path, fonts_dir, hashes)
                packaged_names[candidate.path] = copied.name
                if archive_system_fonts and candidate.is_system:
                    archive_dir = output_root / "本机提取字体存档" / safe_filename(series_root.name)
                    copy_unique(candidate.path, archive_dir, hashes)

    manifest_rows: list[dict[str, object]] = []
    for request, status, matches, note in results:
        names = sorted({packaged_names[candidate.path] for candidate in matches if candidate.path in packaged_names})
        manifest_rows.append(
            {
                "requested_font": request.display_name,
                "bold": int(request.bold),
                "italic": int(request.italic),
                "status": status,
                "packaged_files": ";".join(names),
                "note": note,
            }
        )

    write_csv(
        output_dir / "subtitle-inventory.csv",
        ["subtitle", "encoding", "style", "requested_font", "bold", "italic", "inline_override", "dialogue_events", "note"],
        parsed.inventory_rows,
    )
    write_csv(
        output_dir / "font-manifest.csv",
        ["requested_font", "bold", "italic", "status", "packaged_files", "note"],
        manifest_rows,
    )
    hash_lines = []
    for path in sorted(fonts_dir.iterdir(), key=lambda item: item.name.casefold()):
        hash_lines.append(f"{sha256(path)}  Fonts/{path.name}")
    (output_dir / "SHA256SUMS.txt").write_text("\n".join(hash_lines) + ("\n" if hash_lines else ""), encoding="utf-8")

    changed_sources = []
    for path, snapshot in parsed.snapshots.items():
        stat = path.stat()
        if (stat.st_size, stat.st_mtime_ns) != snapshot:
            changed_sources.append(path.relative_to(series_root).as_posix())
    if changed_sources:
        raise RuntimeError(f"source subtitles changed during run: {changed_sources}")

    status_counts = defaultdict(int)
    for _, status, _, _ in results:
        status_counts[status] += 1
    return {
        "series": series_root.name,
        "output": str(output_dir),
        "subtitles": parsed.subtitle_count,
        "decode_errors": parsed.decode_errors,
        "requests": len(results),
        "matched": status_counts["matched"],
        "missing": status_counts["missing"],
        "ambiguous": status_counts["ambiguous"],
        "packaged_files": len(list(fonts_dir.iterdir())),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["audit", "collect"])
    parser.add_argument("--series", action="append", required=True, type=Path, help="Series directory; repeat for multiple series")
    parser.add_argument("--font-root", action="append", default=[], type=Path, help="Additional font library; repeat as needed")
    parser.add_argument("--output-root", type=Path, default=Path.home() / "Desktop")
    parser.add_argument("--no-system-fonts", action="store_true", help="Do not scan the Windows Fonts directory")
    parser.add_argument("--archive-system-fonts", action="store_true", help="In collect mode, copy selected Windows fonts to the supplementary archive")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    series_roots = [path.expanduser().resolve() for path in args.series]
    output_root = args.output_root.expanduser().resolve()
    for path in series_roots:
        if not path.is_dir():
            raise SystemExit(f"Series directory is inaccessible: {path}")
        if is_relative_to(output_root, path):
            raise SystemExit(f"Output root must be outside the series directory: {output_root}")

    roots: list[tuple[Path, bool]] = []
    if not args.no_system_fonts:
        system_root = os.environ.get("WINDIR") or os.environ.get("SystemRoot")
        if not system_root:
            raise SystemExit("WINDIR/SystemRoot is not defined; pass --no-system-fonts or configure the Windows environment")
        windows_dir = Path(system_root) / "Fonts"
        if windows_dir.is_dir():
            roots.append((windows_dir.resolve(), True))
        else:
            raise SystemExit(f"Windows font directory is inaccessible: {windows_dir}")
    for path in args.font_root:
        resolved = path.expanduser().resolve()
        if not resolved.is_dir():
            raise SystemExit(f"Font root is inaccessible: {resolved}")
        roots.append((resolved, False))

    if args.archive_system_fonts and args.mode != "collect":
        raise SystemExit("--archive-system-fonts is valid only in collect mode")
    output_root.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    summaries = [
        process_series(path, output_root, roots, args.mode, args.archive_system_fonts, stamp)
        for path in series_roots
    ]
    field_order = ["series", "output", "subtitles", "decode_errors", "requests", "matched", "missing", "ambiguous", "packaged_files"]
    print("\t".join(field_order))
    for summary in summaries:
        print("\t".join(str(summary[field]) for field in field_order))
    return 0 if all(summary["decode_errors"] == 0 and summary["ambiguous"] == 0 for summary in summaries) else 2


if __name__ == "__main__":
    raise SystemExit(main())
