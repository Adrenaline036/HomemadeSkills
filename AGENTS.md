# HomemadeSkills repository policy

## Repository structure

- Store each public Skill in one top-level PascalCase directory.
- Keep `SKILL.md` at the Skill directory root.
- Put deterministic helpers in `scripts/`, reusable output templates in `assets/`, and conditional documentation in `references/` only when needed.
- Update the root Skill index whenever adding, renaming, or removing a Skill.

## Privacy and publication

- Treat `local/`, `work/`, `outputs/`, `dist/`, archives, logs, databases, credentials, browser state, deployment artifacts, and private review records as non-public.
- Never commit `.env`, tokens, cookies, passwords, private keys, private endpoints, personal media inventories, raw runtime logs, or machine-specific absolute paths.
- Before every push, inspect tracked files, staged diff, ignored files, and repository history for sensitive data.
- Do not publish `local/development/REVIEW.md` or `develop_log.md`; keep them ignored.

## Validation

- Validate every Skill's frontmatter and directory structure before publication.
- Test any included installer in an isolated temporary project, including duplicate-install protection and recoverable replacement.
- Report local validation, remote push, PR, CI, and live-agent acceptance as separate evidence layers.

## Collaboration

- Use the installed `guide-multi-agent-project` Skill for multi-agent implementation, review, release, and handoff.
- Preserve unrelated changes and use one writer for overlapping files.
- Do not commit, push, open a PR, publish, or deploy unless the current task or private authorization matrix covers that action.
