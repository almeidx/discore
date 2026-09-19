# Plan 006: Collapse the duplicated collector await functions and component `update`/`deferUpdate` methods into single shared implementations

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1ca7855..HEAD -- src/collectors/ src/context/`
> Plans 002 and 005 have landed before this one (see Depends on). What must
> still match the excerpts below: `src/collectors/await-component.ts`,
> `src/collectors/await-modal.ts`, and the `update`/`deferUpdate` methods in
> the three component context files. On a mismatch there, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: MED
- **Depends on**: plans/002-interaction-state-reentrancy.md, plans/005-collector-test-hardening.md
- **Category**: tech-debt
- **Planned at**: commit `1ca7855`, 2026-06-15

## Why this matters

Two copy-paste clusters exist. `src/collectors/await-component.ts` and `src/collectors/await-modal.ts` are byte-identical except for the element type — a timeout-semantics change (e.g. AbortSignal support later) must be made twice and can silently diverge. The `update`/`deferUpdate` methods are pasted three times across `src/context/button.ts`, `src/context/modal.ts`, and `src/context/select-menu.ts`; they also still mark interaction state _after_ the API await — the exact ordering bug plan 002 fixed for `reply`/`defer` — so consolidating them is also the right moment to apply that same mark-before-await + rollback pattern in one place instead of three. Net effect: one timed-await implementation, one update-methods implementation, same public behavior (plus the ordering fix).

## Current state

TypeScript-strict, ESM-only library; pnpm; `node:test`. Conventions: named exports only, kebab-case files, `.ts` import extensions, tabs, no classes, functional factories.

### Cluster 1 — the twin await functions

`src/collectors/await-component.ts` (entire file, 27 lines):

```ts
import type { AwaitComponentOptions } from "../types/contexts.ts";
import type { ComponentInteractionContext } from "../types/internal.ts";
import type { CollectorStore } from "./collector-store.ts";
import { CollectorTimeoutError } from "./errors.ts";

export function awaitComponent(
	store: CollectorStore<ComponentInteractionContext>,
	options: AwaitComponentOptions,
): Promise<ComponentInteractionContext> {
	return new Promise<ComponentInteractionContext>((resolve, reject) => {
		const timer = setTimeout(() => {
			store.unregister(collector);
			reject(new CollectorTimeoutError(options.timeout));
		}, options.timeout);

		const collector = {
			filter: options.filter,
			handle(ctx: ComponentInteractionContext) {
				clearTimeout(timer);
				store.unregister(collector);
				resolve(ctx);
			},
		};

		store.register(collector);
	});
}
```

`src/collectors/await-modal.ts` is the same function with `ModalContext` (from `../types/contexts.ts`) substituted and `AwaitModalOptions` as the options type. Both options types have the identical shape `{ filter: (ctx: T) => boolean; timeout: number }` (`src/types/contexts.ts:46-55`).

Callers of these two functions (verified at planning time): `src/context/command.ts:34-40`, `src/context/user-command.ts:36-42`, `src/context/message-command.ts` (same pattern), and `test/unit/collectors.test.ts` (imports `awaitComponent` directly; after plan 005, also `awaitModal`).

### Cluster 2 — the triplicated update methods

`src/context/button.ts:20-28` (identical in `src/context/modal.ts:22-30` and `src/context/select-menu.ts:21-30`):

```ts
		async update(data: CreateInteractionUpdateMessageResponseOptions): Promise<void> {
			await api.interactions.updateMessage(interaction.id, interaction.token, data);
			controller.markReplied();
		},

		async deferUpdate(): Promise<void> {
			await api.interactions.deferMessageUpdate(interaction.id, interaction.token);
			controller.markDeferred();
		},
```

Each factory obtains `{ context: base, controller } = createManagedInteractionContext(api, gateway, interaction)` and `Object.assign`s these methods on. The `InteractionStateController` interface lives **unexported** in `src/context/interaction.ts:13-16`; after plan 002 lands, `reply`/`defer` there follow the mark-before-await + rollback pattern — mirror it.

Behavior pinned by existing tests: `test/unit/interaction-context.test.ts` (`marks component contexts as acknowledged after update`, `marks component contexts as deferred after deferUpdate`), `test/unit/component-router.test.ts`, and the collector tests construct these contexts.

This plan was refreshed after plans 002 and 005 landed. `src/context/interaction.ts` already has mark-before-await + rollback for `reply`/`defer`/`showModal`, and `test/unit/collectors.test.ts` now has deterministic timeout and `awaitModal` coverage. The current full-suite baseline before this refactor is 180 tests passing.

## Commands you will need

| Purpose     | Command                    | Expected on success                      |
| ----------- | -------------------------- | ---------------------------------------- |
| All tests   | `pnpm test`                | `fail 0`, same count as before this plan |
| Typecheck   | `pnpm run build:typecheck` | exit 0                                   |
| Lint        | `pnpm run lint`            | exit 0                                   |
| Auto-format | `pnpm run fmt`             | exit 0                                   |

## Scope

**In scope**:

- `src/collectors/await-from-store.ts` (create)
- `src/collectors/await-component.ts`, `src/collectors/await-modal.ts` (reduce to thin wrappers)
- `src/context/interaction.ts` (add one exported helper; do not change existing methods)
- `src/context/button.ts`, `src/context/modal.ts`, `src/context/select-menu.ts` (use the helper)
- `test/unit/interaction-context.test.ts` (extend: rollback tests for update/deferUpdate)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):

- `src/collectors/collect-components.ts` — its iterator machinery is genuinely different; only the two await twins are duplicated.
- `src/index.ts` — no new public exports; `awaitFromStore` and the update-methods helper stay internal.
- Call sites in `src/context/command.ts` / `user-command.ts` / `message-command.ts` — the wrapper functions keep their exact signatures, so callers don't change.
- Public types in `src/types/contexts.ts` (`AwaitComponentOptions` / `AwaitModalOptions` stay separate exported names).

## Git workflow

- Branch: `advisor/006-dedupe-collectors-and-update-methods`
- Commit style: short imperative subject (e.g. `Extract shared timed-await collector and component update methods`). Two commits (one per cluster) preferred.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract the generic timed await

Create `src/collectors/await-from-store.ts`:

```ts
import type { CollectorStore } from "./collector-store.ts";
import { CollectorTimeoutError } from "./errors.ts";

export interface AwaitFromStoreOptions<T> {
	filter: (ctx: T) => boolean;
	timeout: number;
}

export function awaitFromStore<T>(store: CollectorStore<T>, options: AwaitFromStoreOptions<T>): Promise<T> {
	// body: identical to the current awaitComponent implementation, with T substituted
}
```

Rewrite `src/collectors/await-component.ts` to:

```ts
import type { AwaitComponentOptions } from "../types/contexts.ts";
import type { ComponentInteractionContext } from "../types/internal.ts";
import type { CollectorStore } from "./collector-store.ts";
import { awaitFromStore } from "./await-from-store.ts";

export function awaitComponent(
	store: CollectorStore<ComponentInteractionContext>,
	options: AwaitComponentOptions,
): Promise<ComponentInteractionContext> {
	return awaitFromStore(store, options);
}
```

and `src/collectors/await-modal.ts` to the same shape with `ModalContext` / `AwaitModalOptions`.

**Verify**: `pnpm run build:typecheck` → exit 0; `node --test ./test/unit/collectors.test.ts` → 0 fail; `grep -c "new Promise" src/collectors/await-component.ts src/collectors/await-modal.ts` → `0` for both files.

### Step 2: Extract the component update methods

In `src/context/interaction.ts`, add (after `createManagedInteractionContext`; reuse the existing `API` and interaction types already imported there — the interaction parameter only needs `{ id, token }` plus what `updateMessage` requires; use the narrowest type that typechecks, `APIInteraction` is already imported):

```ts
export function createComponentUpdateMethods(
	api: API,
	interaction: APIInteraction,
	controller: InteractionStateController,
) {
	return {
		async update(data: CreateInteractionUpdateMessageResponseOptions): Promise<void> {
			// guard + markReplied() before the await + rollback on failure,
			// mirroring the post-plan-002 reply() pattern in this same file
			await api.interactions.updateMessage(interaction.id, interaction.token, data);
		},

		async deferUpdate(): Promise<void> {
			// same pattern with markDeferred()
			await api.interactions.deferMessageUpdate(interaction.id, interaction.token);
		},
	};
}
```

Concretely, match the plan-002 semantics: `update`/`deferUpdate` are initial acknowledgements, so if `replied` is already true they must throw `new Error("Interaction was already acknowledged; update() must be the first response")` (respectively `deferUpdate()`). Problem: the closure flags aren't visible here — so extend `InteractionStateController` (still unexported) with the members this helper needs: add `isReplied(): boolean` and `rollback(): void` (resets both flags to false). Implement them in the controller next to `markReplied`/`markDeferred`. `CreateInteractionUpdateMessageResponseOptions` comes from `@discordjs/core` (type-only import, same as the component context files do today).

Then rewrite the three component context factories to spread the helper:

```ts
return Object.assign(base, {
	interaction,
	customId: interaction.data.custom_id,
	params,
	...createComponentUpdateMethods(api, interaction, controller),
}) as ButtonContext;
```

(keeping each file's extra fields — `values` for select menus, `fields` for modals — exactly where they are).

**Verify**: `pnpm run build:typecheck` → exit 0; `node --test ./test/unit/interaction-context.test.ts ./test/unit/component-router.test.ts` → 0 fail.

### Step 3: Pin the new update semantics with tests

In `test/unit/interaction-context.test.ts`, add to the re-entrancy describe block (created by plan 002):

1. **`update after reply rejects with a descriptive error`**: button context, `await ctx.reply(...)`, then `assert.rejects(ctx.update({ content: "x" }), { message: /already acknowledged/ })`; `updateMessage` callCount 0.
2. **`failed update rolls back`**: `updateMessage` mock rejects once; assert rejection, `ctx.replied === false`, then a subsequent `ctx.update(...)` succeeds.
3. **`failed deferUpdate rolls back`**: same shape for `deferMessageUpdate`, asserting both flags reset.

**Verify**: `node --test ./test/unit/interaction-context.test.ts` → 0 fail.

### Step 4: Full gates

Run `pnpm run fmt`, then:

**Verify**: `pnpm run lint` → exit 0. `pnpm run build:typecheck` → exit 0. `pnpm test` → `fail 0`, no fewer tests than before this plan started (record the count before Step 1).

## Test plan

Existing tests are the regression net (this is why plans 002/005 land first): `interaction-context.test.ts`, `component-router.test.ts`, `collectors.test.ts`, plus the integration flows. New tests: the three update/deferUpdate semantics tests in Step 3.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `src/collectors/await-from-store.ts` exists and `grep -c "new Promise" src/collectors/await-component.ts src/collectors/await-modal.ts` → 0 and 0
- [ ] `grep -c "updateMessage" src/context/button.ts src/context/modal.ts src/context/select-menu.ts` → 0 for all three (the calls live in the shared helper now)
- [ ] `grep -n "createComponentUpdateMethods" src/context/interaction.ts` → defined once; referenced by all three component contexts
- [ ] `pnpm test` exits 0, `fail 0`
- [ ] `pnpm run build:typecheck` and `pnpm run lint` exit 0
- [ ] `git status --porcelain` shows only in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plans 002 or 005 have NOT landed (check `plans/README.md` status) — this plan's Step 2 mirrors 002's pattern and Step 1 relies on 005's awaitModal tests.
- The `update`/`deferUpdate` excerpts don't match the three component context files (drift).
- Typing `createComponentUpdateMethods` requires `any` or a cast that `pnpm run lint` flags — report the typing obstacle instead of suppressing it.
- A modal-specific difference surfaces (e.g. `ModalContext.update` is typed differently from the component ones in `src/types/contexts.ts`) — verify against the types file and report if the consolidation would change a public type.

## Maintenance notes

- Future AbortSignal support for collectors now has a single implementation point (`awaitFromStore`).
- `update()` on a modal that did not originate from a component message has always been a Discord-side 400; the consolidation doesn't change that. If origin detection is ever wanted, `APIModalSubmitInteraction.message` is the signal.
- Reviewer focus: `InteractionStateController` gained `isReplied`/`rollback` — confirm they remain unexported from the package (`src/index.ts` untouched) since they're internal state-machine controls.
