---
summary: "Copy/paste CLI smoke checklist for local verification."
read_when:
  - Pre-merge validation
  - Reproducing a reported CLI bug
---

# Manual testing (CLI)

## Setup

- Ensure logged in: `bun skillhub whoami` (or `bun skillhub login`).
- Optional: set env
  - `SKILLHUB_SITE=https://skillhub.ai`
  - `SKILLHUB_REGISTRY=https://skillhub.ai`

## Smoke

- `bun skillhub --help`
- `bun skillhub --cli-version`
- `bun skillhub whoami`

## Search

- `bun skillhub search gif --limit 5`

## Prod HTTP smoke

- Public prod smoke via Vitest:
  - `bun run test:e2e:prod-http`
- Optional overrides:
  - `SKILLHUB_E2E_SITE=https://skillhub.ai`
  - `SKILLHUB_E2E_SKILL_OWNER=steipete`
  - `SKILLHUB_E2E_SKILL_SLUG=gifgrep`

## Install / list / update

- `mkdir -p /tmp/skillhub-manual && cd /tmp/skillhub-manual`
- `bunx skillhub@beta install gifgrep --force`
- `bunx skillhub@beta list`
- `bunx skillhub@beta update gifgrep --force`

## Publish (changelog optional)

- `mkdir -p /tmp/skillhub-skill-demo/SKILL && cd /tmp/skillhub-skill-demo`
- Create files:
  - `SKILL.md`
  - `notes.md`
- Publish:
  - `bun skillhub publish . --slug skillhub-manual-<ts> --name "Manual <ts>" --version 1.0.0 --tags latest`
- Publish update with empty changelog:
  - `bun skillhub publish . --slug skillhub-manual-<ts> --name "Manual <ts>" --version 1.0.1 --tags latest`

## Delete / undelete (owner/admin)

- `bun skillhub delete skillhub-manual-<ts> --yes`
- Verify hidden:
- `curl -i "https://skillhub.ai/api/v1/skills/skillhub-manual-<ts>"`
- Restore:
  - `bun skillhub undelete skillhub-manual-<ts> --yes`
- Cleanup:
  - `bun skillhub delete skillhub-manual-<ts> --yes`

## Sync

- `bun skillhub sync --dry-run --all`

## Playwright (menu smoke)

Run against prod:

```
PLAYWRIGHT_BASE_URL=https://skillhub.ai bun run test:pw
```

This smoke gate should fail on visible error UI, page errors, and browser
console errors.

Recommended workflow coverage in Playwright:

- home/install-switcher + browse CTA
- `/search` redirect into skills browse
- skills browse -> detail -> owner profile
- souls browse -> detail -> owner profile
- upload signed-out gate
- import signed-out gate
- authenticated upload/import canaries when storage state is configured

Authenticated prod canary:

```
PLAYWRIGHT_BASE_URL=https://skillhub.ai \
PLAYWRIGHT_AUTH_STORAGE_STATE=/path/to/storage-state.json \
bunx playwright test e2e/upload-auth-smoke.pw.test.ts
```

Capture `storage-state.json` once with Playwright or browser devtools after GitHub login.

Run against a local preview server:

```
bun run test:e2e:local
```
