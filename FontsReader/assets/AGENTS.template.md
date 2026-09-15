# Subtitle font workflow entrypoint

When asked to inspect anime subtitles, identify or collect subtitle fonts, prepare Jellyfin fonts, or report missing fonts, load and follow the installed `fonts-reader` Skill before accessing media paths.

Start with its read-only audit gate. Preserve animation, subtitle, seeding, font-library, and Windows font files; never guess replacements for missing exact faces. Keep one unified per-series font folder and finish with manifests, hashes, exact evidence, and unresolved items.

For a large font package, use its bundled `字体索引/字体库-字面索引.csv` before any recursive full-library scan; fall back only when the index is unavailable, invalid, stale for a requested path, or lacks the requested exact internal name.
