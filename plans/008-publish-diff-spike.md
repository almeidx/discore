# Plan 008: Spike — design a diff/dry-run mode for command publishing (investigation and design doc, NO production code)

> **Executor instructions**: This is a SPIKE plan: its deliverable is a design
> document, not source changes. Follow the steps, write the design doc, and
> stop. Do not implement the feature. If anything in the "STOP conditions"
> section occurs, stop and report. When done, update the status row for this
> plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6ec7a23..HEAD -- src/publish.ts`
> If `src/publish.ts` changed since this plan was written, compare the
> excerpt below before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: M (coarse — spike)
- **Risk**: LOW (no production code)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `6ec7a23`, 2026-06-11

## Why this matters

`publishCommands` (`src/publish.ts:96-104`) supports exactly one strategy: bulk overwrite (guild-scoped when `guildId` is set, global otherwise). That is one API call and is Discord's recommended bulk mechanism — so the motivation for a diff mode is **not** API-call savings. The motivation is visibility and safety: today a deploy silently replaces everything, with no way to answer "what will this change?" (a renamed command silently deletes the old one and its permission overrides; a typo'd description ships unnoticed). A `diffCommands` utility — fetch current commands, compare against definitions, report added/updated/removed — gives bot authors a dry-run and CI a drift check. The hard part is comparison correctness: Discord's API returns commands with server-populated defaults and extra fields, so naive deep-equality reports false "updated" on every field Discord normalizes. This spike nails that comparison design before any implementation is attempted.

## Current state

- `src/publish.ts` — `toPayload(cmd)` maps every definition type to a `RESTPostAPI*ApplicationCommandsJSONBody`; `publishCommands`:

```ts
export async function publishCommands(options: PublishCommandsOptions): Promise<APIApplicationCommand[]> {
	const payloads = options.commands.map(toPayload);

	if (options.guildId) {
		return options.api.applicationCommands.bulkOverwriteGuildCommands(options.applicationId, options.guildId, payloads);
	}

	return options.api.applicationCommands.bulkOverwriteGlobalCommands(options.applicationId, payloads);
}
```

- Fetch APIs exist on the same `api.applicationCommands` object (verified in `node_modules/@discordjs/core/dist/index.d.mts` at planning time): `getGlobalCommands(applicationId, query?)` and `getGuildCommands(applicationId, guildId, query?)`, both returning arrays of `APIApplicationCommand`.
- `test/unit/publish.test.ts` exists and `test/fixtures/mock-api.ts` already mocks `applicationCommands.bulkOverwrite*` — a future implementation would extend both.
- The repo convention for utilities is a pure named function taking one options object (see `PublishCommandsOptions`, `src/publish.ts:19-24`).

## Commands you will need

| Purpose                                      | Command                                                                                                                              | Expected on success                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Inspect core API types                       | `grep -n "getGlobalCommands\|getGuildCommands" node_modules/@discordjs/core/dist/index.d.mts`                                        | both present                              |
| Inspect returned command type                | `grep -n -A30 "interface APIApplicationCommand " node_modules/discord-api-types/payloads/v10/_interactions/applicationCommands.d.ts` | field list                                |
| Gates (doc-only plan; nothing should change) | `git status --porcelain`                                                                                                             | only the new design doc + plans/README.md |

## Scope

**In scope** (files you may create/modify):

- `plans/008-publish-diff-design.md` (create — the deliverable)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):

- ANY file under `src/`, `test/`, `examples/` — no implementation, no "small prototype while I'm here".
- `README.md`, `package.json`.

## Git workflow

- Branch: `advisor/008-publish-diff-spike`
- One commit (e.g. `Add publish diff design doc`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Catalog what Discord returns vs what discore sends

Read the `APIApplicationCommand` type (command above) and `src/publish.ts`'s `toPayload` outputs. In the design doc, produce a field table: for each field a definition can send (`name`, `description`, `options`, `default_member_permissions`, `nsfw`, `contexts`, `integration_types`, localizations, …), note what the GET endpoint returns when the field was omitted on PUT (e.g. server-added `id`, `application_id`, `version`, `type` defaulting, `description` of `""` for context-menu commands, option `required` defaulting to `false`, missing-vs-`null` localizations). Mark which fields therefore need normalization before comparison. Where the answer isn't determinable from types alone, mark it `VERIFY-AT-IMPL` rather than guessing.

### Step 2: Specify the comparison algorithm

In the design doc, define `normalize(payload | fetched) → canonical form` covering at minimum: strip server-only fields (`id`, `application_id`, `version`, `guild_id`), apply documented defaults (`type` → 1, option `required` → false, empty `options` array ≡ absent), treat `null` ≡ absent for nullable optionals, and compare option arrays **order-sensitively** (Discord preserves option order and order matters for UX — call this decision out explicitly). Identity key: (`name`, `type`) pair — a changed `type` under the same name is a remove+add, not an update.

### Step 3: Propose the public API

Recommend (and justify against at least one alternative each):

1. A new pure function, separate from `publishCommands`:
   `diffCommands({ api, applicationId, commands, guildId? }) → Promise<{ added: CommandPayload[]; updated: { name: string; before: APIApplicationCommand; after: CommandPayload }[]; removed: APIApplicationCommand[]; unchanged: string[] }>`
   — read-only, composable, testable with the existing mock-api pattern.
2. An optional `dryRun?: boolean` on `publishCommands` that internally calls `diffCommands` and returns without writing (alternative: a separate `publishCommandsIfChanged` — argue one, reject the other).
3. Explicitly NOT a per-command create/patch/delete sync engine — bulk overwrite remains the write path (one call, atomic, preserves IDs of same-named commands). State this as a non-goal with the rationale.

### Step 4: List open questions for the maintainer

At minimum: (a) should `diffCommands` be in the public export surface or stay an example/recipe? (b) is order-sensitive option comparison the right default? (c) how should localization maps compare (key-order-insensitive deep equality)? (d) does the guild/global split need separate diff results for multi-guild deploy patterns? Each question gets a recommended answer.

### Step 5: Write the doc and stop

Assemble steps 1–4 into `plans/008-publish-diff-design.md` with sections: Motivation (one paragraph, reuse this plan's "Why"), Field normalization table, Comparison algorithm, Proposed API (with signatures), Non-goals, Open questions, Implementation estimate (S/M with the test cost included — tests would extend `test/unit/publish.test.ts` with a mocked `getGlobalCommands`).

**Verify**: `git status --porcelain` → exactly `plans/008-publish-diff-design.md` (new) and `plans/README.md` (modified). `pnpm test` → unchanged from before the spike (nothing in src/test was touched).

## Test plan

None — spike produces a document. The doc itself must include the _future_ test plan for the implementation (Step 5's "Implementation estimate" section).

## Done criteria

- [ ] `plans/008-publish-diff-design.md` exists with all seven sections from Step 5
- [ ] Every field in the normalization table is marked normalize / strip / compare-as-is / VERIFY-AT-IMPL
- [ ] No file outside `plans/` was created or modified (`git status --porcelain`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `getGlobalCommands` / `getGuildCommands` are absent from the installed `@discordjs/core` build (the design would need a REST-level fallback — that's a maintainer decision).
- You catch yourself writing implementation code in `src/` — re-read the scope; the deliverable is the doc.

## Maintenance notes

- If the maintainer green-lights the design, the implementation becomes a normal S/M plan: `diffCommands` in `src/publish.ts` (or `src/diff.ts`), tests in `test/unit/publish.test.ts`, README "Command publishing" section update.
- The normalization table is the part that rots: re-verify it against discord-api-types when implementing if months have passed.
