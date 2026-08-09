---
name: fonts-reader
description: Audit anime ASS/SSA subtitles, identify fonts actually used by dialogue styles and inline overrides, match exact internal font names across Windows fonts, user font libraries, loose series fonts, and optional MKV attachments, then collect one editable per-series font folder with manifests and hashes. Use when Codex or TRAE is asked to read animation directories, find subtitle fonts, prepare Jellyfin subtitle fonts, report missing or ambiguous fonts, archive fonts copied from the local Windows installation, or build a subtitle-font package without changing media files.
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

## Establish inputs

Obtain or infer:

1. One or more series directories.
2. The output root; default to the current user's Desktop only when the user did not choose another location.
3. Font search roots. Include the Windows font directory and every user-supplied shared font library. Resolve machine-specific library paths from the current request or environment; never hardcode or publish them.
4. Whether to create the supplementary archive for fonts selected from the Windows font directory.

Verify every path live. If a requested path is inaccessible, report it instead of silently omitting it.

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

Label the evidence accurately: parser/helper test, local filesystem collection, MKV attachment inspection, Jellyfin playback, and user acceptance are separate layers. Font collection alone does not prove Jellyfin rendering or playback.

## Use the bundled resources

- Use `scripts/fonts_reader.py` for deterministic audit and collection.
- Use `scripts/install-trae-project-skill.ps1` to install this same folder into a TRAE project's `.agents/skills/FontsReader` directory with duplicate protection and recoverable replacement.
- Use `assets/AGENTS.template.md` only when a repository needs a short tracked entrypoint that tells agents to load this Skill.

Install for Codex by copying the complete `FontsReader` folder to `%USERPROFILE%\.codex\skills\fonts-reader`. Install for TRAE through its Skills UI or the bundled project installer. Keep `SKILL.md`, `agents/`, `scripts/`, and `assets/` together.
