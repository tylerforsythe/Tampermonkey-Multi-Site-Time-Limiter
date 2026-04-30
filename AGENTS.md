# AGENTS.md

Instructions for agents/LLMs working in this repository.

## Scope

These instructions apply to the entire repository.

## Repository Purpose

- This repo contains a Tampermonkey userscript: `SiteTimeLimiter.user.js`.
- The script limits daily browsing time on configured websites.

## Critical Rules (Keep in Sync)

When editing `SiteTimeLimiter.user.js`, always follow these rules:

1. After any edits to this file, run:
   - `node --check SiteTimeLimiter.user.js`
2. Increment `@version` in the userscript header whenever changes are made.
3. The `@version` value may **not** end in a period (`.`).
4. Sites appearing in `SITE_CONFIG` must also appear in the `@match` metadata list.

These rules mirror the in-file LLM instructions and must remain accurate.

## Editing Guidance

- Keep changes focused and minimal.
- Preserve Tampermonkey metadata block format (`// ==UserScript==` ... `// ==/UserScript==`).
- Do not remove existing `@exclude` entries unless explicitly requested.
- Prefer clear, simple logic over major refactors.

## Validation Checklist

Before finishing changes:

- [ ] `node --check SiteTimeLimiter.user.js` passes.
- [ ] `@version` updated correctly.
- [ ] Every domain in `SITE_CONFIG` is covered by `@match`.
- [ ] No accidental metadata/header corruption.
