# Plan 004: Cover the seven exported context type guards with a full positive/negative test matrix

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 38e1a9d..HEAD -- src/guards.ts src/context/ test/fixtures/interactions.ts`
> If any of these changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `38e1a9d`, 2026-06-15

## Why this matters

`src/guards.ts` exports seven type-guard functions (`isCommand`, `isUserCommand`, `isMessageCommand`, `isButton`, `isSelectMenu`, `isModal`, `isAutocomplete`) from the package's public API (`src/index.ts:67-75`). They are the discrimination mechanism users rely on inside global hooks (`onError`, `beforeInteraction`) to narrow `AnyInteractionContext`. Not a single test references them (verified by grep over `test/` at planning time). A wrong discriminator here returns the wrong context type to user code and nothing in CI would notice. The guards are easy to test exhaustively because each guard must return `true` for exactly one of the seven context kinds and `false` for the other six — a 7×7 matrix.

## Current state

TypeScript-strict, ESM-only library; pnpm; built-in `node:test` runner; tests live in `test/unit/*.test.ts` (kebab-case), use `node:assert/strict` + `describe`/`it`.

- `src/guards.ts` — the seven guards. Each checks `ctx.interaction.type` (and `ctx.interaction.data.type` or `ctx.interaction.data.component_type` where needed). Excerpt (`src/guards.ts:13-18`):

```ts
export function isCommand(ctx: AnyInteractionContext): ctx is CommandContext {
	return (
		ctx.interaction.type === InteractionType.ApplicationCommand &&
		ctx.interaction.data.type === ApplicationCommandType.ChatInput
	);
}
```

- Context factories (all in `src/context/`, all exported):
  - `createCommandContext(api, gateway, interaction, collectorStore, modalCollectorStore)` — `src/context/command.ts`
  - `createUserCommandContext(api, gateway, interaction, collectorStore, modalCollectorStore)` — `src/context/user-command.ts`
  - `createMessageCommandContext(api, gateway, interaction, collectorStore, modalCollectorStore)` — `src/context/message-command.ts`
  - `createButtonContext(api, gateway, interaction, params)` — `src/context/button.ts`
  - `createSelectMenuContext(api, gateway, interaction, params)` — `src/context/select-menu.ts`
  - `createModalContext(api, gateway, interaction, params)` — `src/context/modal.ts`
  - `createAutocompleteContext(api, gateway, interaction)` — `src/context/autocomplete.ts`
- This plan was refreshed after plan 002 landed. `src/context/interaction.ts` now marks acknowledgement state before awaits, but the seven context factory signatures and the guard inputs listed here are unchanged.
- Interaction fixtures (all in `test/fixtures/interactions.ts`): `chatInputInteraction(name)`, `userCommandInteraction(name, targetUserId)`, `messageCommandInteraction(name, targetMessageId)`, `buttonInteraction(customId)`, `selectMenuInteraction(customId, values)`, `modalSubmitInteraction(customId, fields)`, `autocompleteInteraction(commandName, focusedOption)`.
  - `autocompleteInteraction` requires a focused option, e.g. `autocompleteInteraction("search", { name: "query", value: "x", type: 3 })` — the context factory throws if none is focused.
  - `userCommandInteraction("info", "999")` supplies the resolved user the factory requires; `messageCommandInteraction("quote", "555")` supplies the resolved message.
- Existing structural exemplar for constructing contexts in unit tests — `test/unit/interaction-context.test.ts:62-70`:

```ts
const ctx = createCommandContext(
	api,
	{} as any,
	chatInputInteraction("test"),
	createCollectorStore<ComponentInteractionContext>(),
	createCollectorStore<ModalContext>(),
);
```

with `api = createMockAPI()` from `test/fixtures/mock-api.ts`, `createCollectorStore` from `src/collectors/collector-store.ts`, and the types `ComponentInteractionContext` (from `src/types/internal.ts`) / `ModalContext` (from `src/types/contexts.ts`).

- One subtlety the matrix must capture: an autocomplete interaction's `data.type` is also `ChatInput`, but its `interaction.type` is `ApplicationCommandAutocomplete` — `isCommand` must still return `false` for it (the guard checks `interaction.type` first).
- Type-level assertion convention: `test/unit/options-inference.test.ts` uses `@ts-expect-error` comments to pin compile-time behavior (2 occurrences) — repo rules allow `@ts-expect-error` only with an explanation comment.

### Conventions that apply

- Named exports/imports with `.ts` extensions; tabs; `describe`/`it` from `node:test`; `assert` from `node:assert/strict`.

## Commands you will need

| Purpose        | Command                                  | Expected on success |
| -------------- | ---------------------------------------- | ------------------- |
| This test file | `node --test ./test/unit/guards.test.ts` | all pass            |
| All tests      | `pnpm test`                              | `fail 0`            |
| Typecheck      | `pnpm run build:typecheck`               | exit 0              |
| Lint           | `pnpm run lint`                          | exit 0              |
| Auto-format    | `pnpm run fmt`                           | exit 0              |

## Scope

**In scope**:

- `test/unit/guards.test.ts` (create)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):

- `src/guards.ts` — if a guard turns out to be _wrong_, that's a STOP condition (report the bug; don't silently fix production code in a test-only plan).
- `test/fixtures/*` — the existing fixtures suffice.

## Git workflow

- Branch: `advisor/004-guards-test-coverage`
- Commit style: short imperative subject (e.g. `Add unit tests for context type guards`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `test/unit/guards.test.ts` with the 7×7 matrix

Build one context of each of the seven kinds (helper functions at the top of the file, following the exemplar above; reuse a single `createMockAPI()` per context, `{} as any` for the gateway, `{}` for `params`). Then define:

```ts
const guards = { isCommand, isUserCommand, isMessageCommand, isButton, isSelectMenu, isModal, isAutocomplete };
const contexts = {
	isCommand: commandCtx,
	isUserCommand: userCommandCtx,
	isMessageCommand: messageCommandCtx,
	isButton: buttonCtx,
	isSelectMenu: selectMenuCtx,
	isModal: modalCtx,
	isAutocomplete: autocompleteCtx,
};
```

and loop the matrix: for every guard name, `it` asserts the guard returns `true` for its own context and `false` for the other six (generate the `it` cases inside `for` loops over `Object.entries` so each pair is its own test case with a descriptive name like `` `${guardName} rejects ${ctxName} context` ``).

Caveat for the loop typing: the guard functions take `AnyInteractionContext` (exported from `src/types/hooks.ts` via `src/index.ts`); type the context map values as `AnyInteractionContext` to keep the loop well-typed without casts.

Note on buttons vs select menus: both are `MessageComponent` interactions — `isButton`/`isSelectMenu` discriminate on `data.component_type`, so the `buttonInteraction` vs `selectMenuInteraction` fixtures matter; don't construct a select-menu context from a button fixture.

**Verify**: `node --test ./test/unit/guards.test.ts` → exits 0. On the current Node native-TypeScript runner this command may report the file wrapper as one passing test; run `node ./test/unit/guards.test.ts` to see the 49 named matrix cases (7 positive + 42 negative), 0 fail.

### Step 2: Add the type-narrowing compile assertion

Append one runtime-trivial test that pins narrowing at compile time:

```ts
it("narrows the context type", () => {
	const ctx: AnyInteractionContext = commandCtx;
	if (isCommand(ctx)) {
		ctx.options;
	}
	if (isButton(ctx)) {
		ctx.customId;
	}
	assert.ok(true);
});
```

`ctx.options` only exists on `CommandContext` and `ctx.customId` on component contexts — if narrowing breaks, `pnpm run build:typecheck` fails. No `@ts-expect-error` needed.

**Verify**: `pnpm run build:typecheck` → exit 0.

### Step 3: Full gates

Run `pnpm run fmt`, then:

**Verify**: `pnpm run lint` → exit 0. `pnpm test` → `fail 0`, total ≥ 174 when run after plans 001 and 002 (124 current baseline + 50 new).

## Test plan

This plan _is_ a test plan: the 7×7 boolean matrix plus one compile-time narrowing test, in `test/unit/guards.test.ts`, modeled on `test/unit/interaction-context.test.ts` for context construction.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `test/unit/guards.test.ts` exists; `node --test ./test/unit/guards.test.ts` exits 0, and `node ./test/unit/guards.test.ts` reports 50 pass, 0 fail
- [ ] `pnpm test` exits 0, `fail 0`
- [ ] `pnpm run build:typecheck` exits 0
- [ ] `pnpm run lint` exits 0
- [ ] `git status --porcelain` shows only `test/unit/guards.test.ts` and `plans/README.md`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any guard returns the wrong boolean for a correctly-constructed context — that's a production bug; report which guard/context pair and do not modify `src/guards.ts`.
- A context factory throws for a fixture listed above (fixture/factory drift).
- You need more than `{} as any` for the gateway or new fixtures — the existing ones were verified sufficient at planning time.

## Maintenance notes

- When a new interaction kind gets a guard (e.g. a future entry-point or premium guard), extend the matrix maps — the loops pick it up automatically.
- Reviewer focus: the matrix loops must iterate over _named_ test cases (visible in `node --test` output), not one giant assertion block — failure messages should name the guard/context pair.
