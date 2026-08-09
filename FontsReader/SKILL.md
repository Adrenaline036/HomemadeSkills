---
name: fonts-reader
description: Audit anime ASS/SSA subtitles, identify fonts actually used by dialogue styles and inline overrides, accelerate repeated package lookups with a local metadata manifest, prefer exact matches from user font libraries or series files, fall back to Windows fonts only when that preferred tier has no exact match, and collect one editable per-series font folder with manifests and hashes. Use when Codex or TRAE is asked to read animation directories, find subtitle fonts, prepare Jellyfin subtitle fonts, report missing or ambiguous fonts, archive fonts copied from the local Windows installation, or build a subtitle-font package without changing media files.
---

# FontsReader

Collect subtitle fonts conservatively and reproducibly. Use this same package in Codex and TRAE; do not maintain runtime-specific copies of the workflow.

## Protect media and fonts

- Treat animation, subtitle, seeding, font-library, and Windows font directories as read-only.
- Never rename, move, delete, rewrite, or normalize source media or subtitles.
- Write only to a new output directory and an optional separate local-font archive directory chosen by the user.
- Keep one unified `Fonts/` directory per series. Do not split it by origin.
- Do not add origin columns or `source-package` / `workstation-supplement` fields to manifests, recommendations, or automation output.
- Preserve original font filenames. Deduplicate identical files by SHA-256 and disambiguate different files with colliding filenames.
- Never substitute a similar font for a missing exact face unless the user explicitly approves that exact substitution after reviewing the report.
- Search loose series fonts, verified temporary MKV attachments, and user-supplied font libraries as one preferred tier. Search Windows fonts only when that entire preferred tier has no exact internal-name candidate for the request.
- If the preferred tier contains exact candidates but they are style-mismatched or ambiguous, keep their normal `matched`/`ambiguous` result. Do not replace them with a Windows candidate merely because Windows has a closer style or a single candidate.

## Establish inputs

Obtain or infer:

1. One or more series directories.
2. The output root; default to the current user's Desktop only when the user did not choose another location.
3. Font search roots. Treat every user-supplied shared font library as preferred and the Windows font directory as fallback-only. Resolve machine-specific library paths from the current request or environment; never hardcode or publish them.
4. Whether to create the supplementary archive for fonts selected from the Windows font directory.

Verify every path live. If a requested path is inaccessible, report it instead of silently omitting it.

## Build and reuse font-package metadata

Index each large user font library before the first subtitle audit:

```powershell
python -X utf8 .\scripts\fonts_reader.py index `
  --font-root "$env:FONT_LIBRARY_ROOT"
```

The helper writes local JSON metadata under `%LOCALAPPDATA%\FontsReader\font-package-manifests` by default. Pass `--manifest-dir` to choose another cache directory, or `--refresh-font-manifest` to force a full rebuild. Keep this cache outside the read-only font library.

The metadata records a relative font path, file size and modification time, the package inventory fingerprint, every TTC/OTC face, normalized internal names, primary and strong names, and bold/italic attributes. It never stores the machine-specific absolute font-library path and does not add origin fields to the delivered series manifest.

`audit` and `collect` load this metadata automatically for every `--font-root`:

1. If the inventory fingerprint and file metadata still match, use indexed faces before opening font files.
2. If metadata is absent, corrupt, from another root, or the font inventory changed, rebuild it with a complete scan.
3. If a newly requested exact name is absent from an otherwise valid cache, perform one fallback full scan. Record a confirmed negative lookup so the unchanged package is not rescanned for that name on later runs.
4. Continue to search loose series fonts directly and use Windows fonts only after the whole preferred tier has no exact candidate.

The package metadata is an acceleration cache. It does not replace the delivered `font-manifest.csv`, change matching priority, split the unified `Fonts/` directory, or authorize writes into a font library.

## Run two gates

### Gate 1: read-only audit

Run the bundled helper in audit mode:

```powershell
python -X utf8 .\scripts\fonts_reader.py audit `
  --series "$env:SERIES_ROOT" `
  --font-root "$env:FONT_LIBRARY_ROOT" `
  --output-root "$env:USERPROFILE\Desktop"
```

The helper parses `.ass` and `.ssa` files without editing them. It must:

- decode common Unicode and legacy subtitle encodings and record decode failures;
- read style `Format` declarations rather than assuming fixed column positions;
- include only styles referenced by dialogue events;
- treat legacy event references such as `*Default` as `Default` when that is the unambiguous defined style;
- include inline `\fn` overrides, including overrides inside transforms;
- retain requested bold/italic face information;
- scan every face in `.ttc` and `.otc` collections before closing the collection;
- match normalized internal Family, Typographic Family, Full, PostScript, and compatible name records, not filenames alone;
- complete matching against the preferred tier before considering Windows fonts, falling back to Windows only when the preferred tier contains no exact internal-name candidate;
- report different exact candidates as `ambiguous` and absent exact names as `missing`.

Review `subtitle-inventory.csv` and `font-manifest.csv`. For unresolved names, inspect loose font files in the series directory. If `mkvmerge` and `mkvextract` are available, list relevant MKV attachments and inspect embedded font faces in a temporary output location. Do not extract or modify media in place. Rerun the audit with any verified temporary attachment directory passed as another `--font-root`.

Stop before collection when decode errors, ambiguous matches, output collisions, inaccessible roots, or unexpected media paths could change the result. Missing exact fonts may proceed only as explicit `missing` rows; do not conceal them.

### Gate 2: collect after review

After the audit is acceptable, rerun in collect mode with the same inputs:

```powershell
python -X utf8 .\scripts\fonts_reader.py collect `
  --series "$env:SERIES_ROOT" `
  --font-root "$env:FONT_LIBRARY_ROOT" `
  --output-root "$env:USERPROFILE\Desktop" `
  --archive-system-fonts
```

Create one new editable folder per series, never a ZIP by default:

```text
<series>-subtitle-fonts-<timestamp>/
|-- Fonts/
|-- font-manifest.csv
|-- subtitle-inventory.csv
`-- SHA256SUMS.txt
```

When `--archive-system-fonts` is enabled, also copy each selected Windows font once into `<output-root>/本机提取字体存档/<series>/`. This supplementary user archive does not change the unified series package and must not add provenance fields to either manifest.

## Verify the result

For every series:

1. Confirm the source directory's file inventory and timestamps were not changed by the workflow.
2. Confirm every `matched` manifest row names at least one file present under `Fonts/`.
3. Confirm every packaged font appears once in `SHA256SUMS.txt` and every hash recomputes correctly.
4. Confirm missing and ambiguous requests remain visible and no guessed font was copied for them.
5. Confirm the number of parsed subtitle files, decode errors, unique requested faces, matched faces, missing faces, and ambiguous faces.
6. If Windows fonts were archived, compare their hashes with the corresponding unified package files.
7. For a large reusable font library, run `index` twice and confirm the first run reports `built` and the unchanged second run reports `hit`. When testing a cache miss, confirm only the first new absent query reports `fallback scan`; the next unchanged run must use the recorded negative lookup.

Label the evidence accurately: parser/helper test, local filesystem collection, MKV attachment inspection, Jellyfin playback, and user acceptance are separate layers. Font collection alone does not prove Jellyfin rendering or playback.

## Use the bundled resources

- Use `scripts/fonts_reader.py` for deterministic font-package indexing, audit, and collection.
- Use `scripts/install-trae-project-skill.ps1` to install this same folder into a TRAE project's `.agents/skills/FontsReader` directory with duplicate protection and recoverable replacement.
- Use `assets/AGENTS.template.md` only when a repository needs a short tracked entrypoint that tells agents to load this Skill.

Install for Codex by copying the complete `FontsReader` folder to `%USERPROFILE%\.codex\skills\fonts-reader`. Install for TRAE through its Skills UI or the bundled project installer. Keep `SKILL.md`, `agents/`, `scripts/`, and `assets/` together.
