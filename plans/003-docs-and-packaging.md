# Plan 003: Make the published front door correct — README quick start compiles, `awaitModal` is documented, AGENTS.md states the real peer dependency, and the package declares `sideEffects: false`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 38e1a9d..HEAD -- README.md AGENTS.md package.json src/publish.ts src/bot.ts`
> If any of these changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs / dx
- **Planned at**: commit `38e1a9d`, 2026-06-15

## Why this matters

`@almeidx/discore` is published to npm; the README is the first (often only) thing a potential user reads. Its quick-start currently calls `publishCommands({ rest, commands })`, which does not compile — the real signature requires `{ api, applicationId, commands }` — so the very first copy-paste fails. The README also never mentions `ctx.awaitModal` even though it's a fully working, tested feature (the Features list stops at `awaitComponent`/`collectComponents`). `AGENTS.md` tells coding agents the peer dependency is `@discordjs/core >= 2.0.0` when the package actually requires `>=3.0.0-dev` — actively wrong instructions for any agent working on this repo. Finally, the package is pure-ESM with no module-level side effects but doesn't declare `"sideEffects": false`, so bundlers can't tree-shake unused exports out of consumers' bots.

## Current state

- `README.md` — quick start at lines 26-55; Features list at lines 5-12 (`- **Collectors** — \`awaitComponent\` (single, Promise-based) and \`collectComponents\` (async iterator).` is line 10); Collectors section at lines 101-118; no Development/Contributing section anywhere.
- `AGENTS.md:13` — `- **Peer dependency**: \`@discordjs/core\` >= 2.0.0` (stale).
- `package.json` — no `sideEffects` field; uses **tab indentation**; `peerDependencies` require `@discordjs/core >=3.0.0-dev` (lines 59-62).
- `src/publish.ts:19-24` — the real options type:

```ts
export interface PublishCommandsOptions {
	api: API;
	applicationId: string;
	commands: AnyCommandDefinition[];
	guildId?: string;
}
```

- `src/bot.ts:41-43` — `createBot` returns a `Bot` whose first field is `api: API` (so `bot.api` is the natural way to get the `API` instance the quick start needs).
- The repo's own example shows correct usage at `examples/basic-bot.ts:50`:

```ts
const published = await publishCommands({ api: bot.api, applicationId: process.env.DISCORD_APP_ID!, commands: [ping] });
```

- The broken README lines (`README.md:52-54`):

```ts
createBot({ rest, gateway, commands: [ping] });
await publishCommands({ rest, commands: [ping] });
await gateway.connect();
```

- This plan was refreshed after plans 001 and 002 landed. The README "Error handling" section now has an extra dispatch-error paragraph, and `src/bot.ts` has dispatch error aggregation, but the quick-start, `Bot.api`, `PublishCommandsOptions`, AGENTS peer line, package manifest, and collectors documentation gaps above are unchanged.

- `awaitModal` exists on command/user-command/message-command contexts (`src/context/command.ts:38-40`), is exercised by `test/integration/collector-flow.test.ts:70-86`, and is demonstrated in `examples/config-command.ts:190-197`. Modal fields are read with `response.fields.getRequired("name")` / `.get("name")`.
- Side-effect check (already performed when writing this plan): `src/index.ts` is pure re-exports; every `src/` module only declares functions/types/consts — no top-level execution. `"sideEffects": false` is safe.

### Conventions that apply

- Markdown code samples in README use real, compiling API calls with tab indentation, matching `examples/`.
- `package.json` is tab-indented; keep key order stable (insert `sideEffects` after `"type": "module"`).

## Commands you will need

| Purpose                                          | Command                    | Expected on success    |
| ------------------------------------------------ | -------------------------- | ---------------------- |
| Typecheck (guards package.json/example validity) | `pnpm run build:typecheck` | exit 0                 |
| Lint/format check                                | `pnpm run lint`            | exit 0                 |
| Tests                                            | `pnpm test`                | `fail 0`               |
| Build (validates package config)                 | `pnpm build`               | exit 0, writes `dist/` |

## Scope

**In scope** (the only files you should modify):

- `README.md`
- `AGENTS.md`
- `package.json`
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):

- `CLAUDE.md` if it exists as a separate file or symlink to AGENTS.md — editing `AGENTS.md` is sufficient; if `CLAUDE.md` is a real independent file with the same stale line, report it, don't edit it.
- Any `src/` or `examples/` file — the examples are already correct.
- `CHANGELOG.md`.
- Renaming/restructuring README sections beyond the listed edits.

## Git workflow

- Branch: `advisor/003-docs-and-packaging`
- Commit style: short imperative subject (e.g. `Fix README quick start and document awaitModal`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix the quick start in `README.md`

Replace lines 52-54 (the three lines quoted in Current state) with:

```ts
const bot = createBot({ rest, gateway, commands: [ping] });
await publishCommands({ api: bot.api, applicationId: process.env.DISCORD_APP_ID!, commands: [ping] });
await gateway.connect();
```

**Verify**: `grep -n "publishCommands({ rest" README.md` → no matches; `grep -n "applicationId" README.md` → at least one match.

### Step 2: Document `awaitModal`

1. Update the Features bullet (line 10) to:
   `- **Collectors** — \`awaitComponent\` and \`awaitModal\` (single, Promise-based) and \`collectComponents\` (async iterator).`
2. In the `## Collectors` section (after the existing `collectComponents` sample, before `## More examples`), add:

````markdown
Modals are collected the same way — show the modal, then await its submission:

```ts
await ctx.showModal({
	title: "Feedback",
	custom_id: "feedback-modal",
	components: [/* ... */],
});

const submission = await ctx.awaitModal({
	filter: (i) => i.customId === "feedback-modal",
	timeout: 300_000,
});

const message = submission.fields.getRequired("message");
await submission.reply({ content: "Thanks for the feedback!" });
```

`awaitComponent`, `awaitModal`, and `collectComponents` reject (or end) with a `CollectorTimeoutError` when the timeout elapses — wrap them in `try/catch` if a timeout is an expected outcome (see `examples/config-command.ts`).
````

Note: `awaitComponent`/`collectComponents` reject with `CollectorTimeoutError` only for `awaitComponent`/`awaitModal`; `collectComponents` ends silently with reason `"timeout"`. Keep the wording above as written — it says "reject (or end)".

**Verify**: `grep -c "awaitModal" README.md` → ≥ 3.

### Step 3: Fix `AGENTS.md:13`

Change `- **Peer dependency**: \`@discordjs/core\` >= 2.0.0`to`- **Peer dependency**: \`@discordjs/core\` >= 3.0.0-dev`.

**Verify**: `grep -n "2.0.0" AGENTS.md` → no matches.

### Step 4: Declare `sideEffects: false` in `package.json`

Insert `"sideEffects": false,` on its own line directly after the `"type": "module",` line, preserving tab indentation.

**Verify**: `node -e "const p = require('./package.json'); if (p.sideEffects !== false) process.exit(1)"` → exit 0.

### Step 5: Add a Development section to `README.md`

Before `## License`, insert:

````markdown
## Development

```sh
pnpm install
pnpm test              # node:test suite
pnpm run lint          # oxfmt --check && oxlint
pnpm run build:typecheck
pnpm build             # tsdown → dist/
```
````

**Verify**: `grep -n "## Development" README.md` → one match.

### Step 6: Full gates

**Verify**: `pnpm run lint` → exit 0. `pnpm run build:typecheck` → exit 0. `pnpm test` → `fail 0`. `pnpm build` → exit 0 (confirms `package.json` is still valid for tsdown).

## Test plan

No new tests — docs and manifest only. The gates above (especially `pnpm build` after the `package.json` edit) are the verification.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "publishCommands({ rest" README.md` → empty
- [ ] `grep -c "awaitModal" README.md` ≥ 3
- [ ] `grep -n "2.0.0" AGENTS.md` → empty
- [ ] `node -e "const p = require('./package.json'); process.exit(p.sideEffects === false ? 0 : 1)"` → exit 0
- [ ] `grep -n "## Development" README.md` → one match
- [ ] `pnpm run lint`, `pnpm run build:typecheck`, `pnpm test`, `pnpm build` all exit 0
- [ ] `git status --porcelain` shows changes only to in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `src/publish.ts`'s `PublishCommandsOptions` no longer matches the excerpt (the README fix would then be wrong).
- You find a top-level side effect in any `src/` module (e.g. module-scope code that runs on import) — `sideEffects: false` would then be unsafe; skip Step 4 and report.
- `CLAUDE.md` exists as an independent file (not a symlink) with its own stale version line — report it for a follow-up rather than expanding scope.

## Maintenance notes

- Plan 001 appends a paragraph to the README "Error handling" section — different section, textual merges only.
- When discord.js v3 goes stable, the peer ranges and both docs need a coordinated update (see the index's "considered and rejected" notes on the dev-snapshot peer range).
- Reviewer focus: the quick-start must stay copy-paste-runnable — it now requires `DISCORD_APP_ID` in addition to `DISCORD_TOKEN`, matching `examples/basic-bot.ts`.
