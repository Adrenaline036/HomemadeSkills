#!/usr/bin/env python3
"""Read-only ASS/SSA font audit and conservative per-series collection."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
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
FONT_PACKAGE_MANIFEST_SCHEMA = 1
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


@dataclass
class FontPackageCatalog:
    root: Path
    manifest_path: Path
    candidates: list[FontCandidate]
    negative_queries: set[str]
    inventory_fingerprint: str
    file_count: int
    cache_state: str


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


def default_manifest_dir() -> Path:
    local_app_data = os.environ.get("LOCALAPPDATA")
    base = Path(local_app_data) if local_app_data else Path.home() / ".cache"
    return base / "FontsReader" / "font-package-manifests"


def font_root_key(root: Path) -> str:
    normalized = os.path.normcase(str(root.resolve()))
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def manifest_path_for(root: Path, manifest_dir: Path) -> Path:
    return manifest_dir / f"{safe_filename(root.name)}-{font_root_key(root)[:12]}.json"


def font_inventory(root: Path) -> tuple[list[Path], str]:
    files = [path for path, _ in discover_font_files([(root, False)])]
    digest = hashlib.sha256()
    for path in files:
        stat = path.stat()
        relative = path.relative_to(root).as_posix()
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(str(stat.st_size).encode("ascii"))
        digest.update(b"\0")
        digest.update(str(stat.st_mtime_ns).encode("ascii"))
        digest.update(b"\n")
    return files, digest.hexdigest()


def scan_font_files(files: list[Path], is_system: bool = False) -> list[FontCandidate]:
    candidates: list[FontCandidate] = []
    for path in files:
        candidates.extend(iter_font_candidates(path, is_system))
    return candidates


def serialize_font_manifest(catalog: FontPackageCatalog, files: list[Path]) -> dict[str, object]:
    faces_by_path: dict[Path, list[FontCandidate]] = defaultdict(list)
    for candidate in catalog.candidates:
        faces_by_path[candidate.path].append(candidate)

    file_rows: list[dict[str, object]] = []
    for path in files:
        stat = path.stat()
        face_rows = []
        for candidate in sorted(faces_by_path.get(path, []), key=lambda item: item.face_index):
            face_rows.append(
                {
                    "face_index": candidate.face_index,
                    "names": sorted(candidate.names),
                    "primary_names": sorted(candidate.primary_names),
                    "strong_names": sorted(candidate.strong_names),
                    "bold": candidate.bold,
                    "italic": candidate.italic,
                }
            )
        file_rows.append(
            {
                "relative_path": path.relative_to(catalog.root).as_posix(),
                "size": stat.st_size,
                "mtime_ns": stat.st_mtime_ns,
                "faces": face_rows,
            }
        )
    return {
        "schema_version": FONT_PACKAGE_MANIFEST_SCHEMA,
        "generator": "fonts-reader",
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "font_root_key": font_root_key(catalog.root),
        "inventory_fingerprint": catalog.inventory_fingerprint,
        "complete_scan": True,
        "negative_queries": sorted(catalog.negative_queries),
        "files": file_rows,
    }


def write_font_manifest(catalog: FontPackageCatalog, files: list[Path]) -> None:
    catalog.manifest_path.parent.mkdir(parents=True, exist_ok=True)
    payload = serialize_font_manifest(catalog, files)
    temporary = catalog.manifest_path.with_suffix(catalog.manifest_path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.replace(temporary, catalog.manifest_path)


def build_font_catalog(root: Path, manifest_path: Path, negative_queries: set[str] | None = None) -> FontPackageCatalog:
    files, fingerprint = font_inventory(root)
    candidates = scan_font_files(files)
    catalog = FontPackageCatalog(
        root=root,
        manifest_path=manifest_path,
        candidates=candidates,
        negative_queries=set(negative_queries or ()),
        inventory_fingerprint=fingerprint,
        file_count=len(files),
        cache_state="built",
    )
    write_font_manifest(catalog, files)
    print(
        f"font package manifest built: {manifest_path} ({len(files)} files, {len(candidates)} faces)",
        file=sys.stderr,
    )
    return catalog


def candidate_from_manifest(root: Path, relative_path: str, face: dict[str, object]) -> FontCandidate:
    relative = Path(relative_path)
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError(f"unsafe manifest path: {relative_path}")
    path = (root / relative).resolve()
    if not is_relative_to(path, root):
        raise ValueError(f"manifest path escapes font root: {relative_path}")
    return FontCandidate(
        path=path,
        face_index=int(face["face_index"]),
        names=frozenset(str(item) for item in face["names"]),
        primary_names=frozenset(str(item) for item in face["primary_names"]),
        strong_names=frozenset(str(item) for item in face["strong_names"]),
        bold=bool(face["bold"]),
        italic=bool(face["italic"]),
        is_system=False,
    )


def load_font_catalog(root: Path, manifest_path: Path, refresh: bool = False) -> FontPackageCatalog:
    files, fingerprint = font_inventory(root)
    if refresh or not manifest_path.is_file():
        return build_font_catalog(root, manifest_path)

    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
        if payload.get("schema_version") != FONT_PACKAGE_MANIFEST_SCHEMA:
            raise ValueError("unsupported schema version")
        if payload.get("font_root_key") != font_root_key(root):
            raise ValueError("font root does not match")
        if payload.get("inventory_fingerprint") != fingerprint:
            raise ValueError("font inventory changed")
        if payload.get("complete_scan") is not True:
            raise ValueError("manifest is not a complete scan")

        file_rows = payload["files"]
        if not isinstance(file_rows, list):
            raise ValueError("manifest files must be a list")
        expected_paths = [path.relative_to(root).as_posix() for path in files]
        listed_paths = [str(file_row["relative_path"]) for file_row in file_rows]
        if len(listed_paths) != len(set(listed_paths)) or sorted(listed_paths) != sorted(expected_paths):
            raise ValueError("manifest file inventory is incomplete")

        candidates: list[FontCandidate] = []
        for file_row in file_rows:
            relative_path = str(file_row["relative_path"])
            path = (root / Path(relative_path)).resolve()
            stat = path.stat()
            if stat.st_size != int(file_row["size"]) or stat.st_mtime_ns != int(file_row["mtime_ns"]):
                raise ValueError(f"font metadata changed: {relative_path}")
            for face in file_row["faces"]:
                candidates.append(candidate_from_manifest(root, relative_path, face))
        catalog = FontPackageCatalog(
            root=root,
            manifest_path=manifest_path,
            candidates=candidates,
            negative_queries={str(item) for item in payload.get("negative_queries", [])},
            inventory_fingerprint=fingerprint,
            file_count=len(files),
            cache_state="hit",
        )
        print(
            f"font package manifest hit: {manifest_path} ({len(files)} files, {len(candidates)} faces)",
            file=sys.stderr,
        )
        return catalog
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        print(f"font package manifest invalid; rebuilding {manifest_path}: {exc}", file=sys.stderr)
        return build_font_catalog(root, manifest_path)


def catalog_name_set(catalogs: list[FontPackageCatalog]) -> set[str]:
    return {name for catalog in catalogs for candidate in catalog.candidates for name in candidate.names}


def ensure_manifest_queries(
    catalogs: list[FontPackageCatalog],
    requested_names: set[str],
    loose_names: set[str],
) -> list[FontPackageCatalog]:
    available = loose_names | catalog_name_set(catalogs)
    unresolved = requested_names - available
    if not unresolved:
        return catalogs

    for index, catalog in enumerate(catalogs):
        pending = unresolved - catalog.negative_queries
        if not pending:
            continue
        if catalog.cache_state == "hit":
            print(
                f"font package manifest miss; fallback scan: {catalog.root} ({len(pending)} names)",
                file=sys.stderr,
            )
            catalog = build_font_catalog(catalog.root, catalog.manifest_path, catalog.negative_queries)
            catalogs[index] = catalog

        names_after_scan = {name for candidate in catalog.candidates for name in candidate.names}
        confirmed_missing = pending - names_after_scan
        if confirmed_missing:
            catalog.negative_queries.update(confirmed_missing)
            files, fingerprint = font_inventory(catalog.root)
            catalog.inventory_fingerprint = fingerprint
            catalog.file_count = len(files)
            write_font_manifest(catalog, files)
        available = loose_names | catalog_name_set(catalogs)
        unresolved = requested_names - available
        if not unresolved:
            break
    return catalogs


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def match_exact_candidates(
    request: FontRequest,
    exact: list[FontCandidate],
    hashes: dict[Path, str],
) -> tuple[str, list[FontCandidate], str]:
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


def match_request(request: FontRequest, candidates: list[FontCandidate], hashes: dict[Path, str]) -> tuple[str, list[FontCandidate], str]:
    preferred_exact = [
        candidate
        for candidate in candidates
        if not candidate.is_system and request.normalized_name in candidate.names
    ]
    if preferred_exact:
        return match_exact_candidates(request, preferred_exact, hashes)

    system_exact = [
        candidate
        for candidate in candidates
        if candidate.is_system and request.normalized_name in candidate.names
    ]
    if system_exact:
        return match_exact_candidates(request, system_exact, hashes)
    return "missing", [], "no exact internal-name match"


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
    font_catalogs: list[FontPackageCatalog],
    system_roots: list[tuple[Path, bool]],
    mode: str,
    archive_system_fonts: bool,
    stamp: str,
) -> dict[str, object]:
    parsed = parse_series(series_root)
    loose_files = [path for path, _ in discover_font_files([(series_root, False)])]
    loose_candidates = scan_font_files(loose_files)
    requested_names = {request.normalized_name for request in parsed.requests.values()}
    loose_names = {name for candidate in loose_candidates for name in candidate.names}
    ensure_manifest_queries(font_catalogs, requested_names, loose_names)
    package_candidates = [candidate for catalog in font_catalogs for candidate in catalog.candidates]
    preferred_candidates = [*loose_candidates, *package_candidates]

    preferred_names = {name for candidate in preferred_candidates for name in candidate.names}
    system_candidates: list[FontCandidate] = []
    if requested_names - preferred_names:
        system_files = discover_font_files(system_roots)
        system_candidates = scan_font_files([path for path, _ in system_files], is_system=True)
    candidates = [*preferred_candidates, *system_candidates]

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
    parser.add_argument("mode", choices=["index", "audit", "collect"])
    parser.add_argument("--series", action="append", default=[], type=Path, help="Series directory; repeat for multiple series")
    parser.add_argument("--font-root", action="append", default=[], type=Path, help="Additional font library; repeat as needed")
    parser.add_argument("--manifest-dir", type=Path, help="Font-package metadata directory; defaults to the local FontsReader cache")
    parser.add_argument("--refresh-font-manifest", action="store_true", help="Ignore cached package metadata and rebuild it")
    parser.add_argument("--output-root", type=Path, default=Path.home() / "Desktop")
    parser.add_argument("--no-system-fonts", action="store_true", help="Do not scan the Windows Fonts directory")
    parser.add_argument("--archive-system-fonts", action="store_true", help="In collect mode, copy selected Windows fonts to the supplementary archive")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    series_roots = [path.expanduser().resolve() for path in args.series]
    output_root = args.output_root.expanduser().resolve()
    manifest_dir = (args.manifest_dir or default_manifest_dir()).expanduser().resolve()
    for path in series_roots:
        if not path.is_dir():
            raise SystemExit(f"Series directory is inaccessible: {path}")
        if is_relative_to(output_root, path):
            raise SystemExit(f"Output root must be outside the series directory: {output_root}")

    system_roots: list[tuple[Path, bool]] = []
    if not args.no_system_fonts:
        system_root = os.environ.get("WINDIR") or os.environ.get("SystemRoot")
        if not system_root:
            raise SystemExit("WINDIR/SystemRoot is not defined; pass --no-system-fonts or configure the Windows environment")
        windows_dir = Path(system_root) / "Fonts"
        if windows_dir.is_dir():
            system_roots.append((windows_dir.resolve(), True))
        else:
            raise SystemExit(f"Windows font directory is inaccessible: {windows_dir}")
    font_roots: list[Path] = []
    for path in args.font_root:
        resolved = path.expanduser().resolve()
        if not resolved.is_dir():
            raise SystemExit(f"Font root is inaccessible: {resolved}")
        font_roots.append(resolved)
    for protected_root in [*series_roots, *font_roots]:
        if is_relative_to(manifest_dir, protected_root):
            raise SystemExit(f"Manifest directory must be outside read-only input roots: {manifest_dir}")

    if args.mode == "index":
        if series_roots:
            raise SystemExit("index mode does not accept --series")
        if not font_roots:
            raise SystemExit("index mode requires at least one --font-root")
        catalogs = [
            load_font_catalog(root, manifest_path_for(root, manifest_dir), refresh=args.refresh_font_manifest)
            for root in font_roots
        ]
        print("font_root\tmanifest\tfiles\tfaces\tstate")
        for catalog in catalogs:
            print(
                f"{catalog.root}\t{catalog.manifest_path}\t{catalog.file_count}\t"
                f"{len(catalog.candidates)}\t{catalog.cache_state}"
            )
        return 0

    if not series_roots:
        raise SystemExit(f"{args.mode} mode requires at least one --series")
    font_catalogs = [
        load_font_catalog(root, manifest_path_for(root, manifest_dir), refresh=args.refresh_font_manifest)
        for root in font_roots
    ]

    if args.archive_system_fonts and args.mode != "collect":
        raise SystemExit("--archive-system-fonts is valid only in collect mode")
    output_root.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    summaries = [
        process_series(path, output_root, font_catalogs, system_roots, args.mode, args.archive_system_fonts, stamp)
        for path in series_roots
    ]
    field_order = ["series", "output", "subtitles", "decode_errors", "requests", "matched", "missing", "ambiguous", "packaged_files"]
    print("\t".join(field_order))
    for summary in summaries:
        print("\t".join(str(summary[field]) for field in field_order))
    return 0 if all(summary["decode_errors"] == 0 and summary["ambiguous"] == 0 for summary in summaries) else 2


if __name__ == "__main__":
    raise SystemExit(main())
