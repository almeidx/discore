# Plan 002: Make the interaction reply/defer state machine re-entrant — concurrent `reply()` calls route correctly and `defer()`/`showModal()` reject double-acknowledgement with a clear error

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6ec7a23..HEAD -- src/context/interaction.ts test/unit/interaction-context.test.ts`
> If either file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6ec7a23`, 2026-06-11

## Why this matters

Discord allows exactly one initial response per interaction; discore tracks this with closure flags so a second `ctx.reply()` transparently becomes a follow-up message. But the flags are set _after_ the API call resolves, so two concurrent `reply()` calls (e.g. `Promise.all([ctx.reply(a), ctx.reply(b)])` in a user handler) both observe `replied === false`, both take the initial-reply path, and the second one fails with a Discord 400 ("interaction already acknowledged") instead of becoming a follow-up. Separately, `defer()` and `showModal()` never check the flags at all, so calling either after a reply produces an opaque Discord API error instead of a clear framework error. This plan makes the state transitions happen before the await (with rollback on failure, so a retry after a network error still works) and adds explicit guards with descriptive errors.

## Current state

TypeScript-strict, ESM-only library (Node >= 24 runs `.ts` natively; pnpm; built-in `node:test` runner).

- `src/context/interaction.ts` — the only production file in scope. `createManagedInteractionContext` holds `replied`/`deferred` closure flags and returns `{ context, controller }`; every interaction context type composes it.
- `test/unit/interaction-context.test.ts` — existing tests pinning current behavior (sequential reply→reply delegates to followUp at `:27-37`; defer marks both flags at `:39-49`; showModal marks replied at `:51-60`).

### `src/context/interaction.ts:28-67` and `:85-88` as of `6ec7a23`

```ts
let replied = false;
let deferred = false;

const controller: InteractionStateController = {
	markReplied() {
		replied = true;
	},

	markDeferred() {
		deferred = true;
		replied = true;
	},
};
```

```ts
		async reply(data: CreateInteractionResponseOptions): Promise<void> {
			if (replied) {
				await api.interactions.followUp(interaction.application_id, interaction.token, data);
				return;
			}
			await api.interactions.reply(interaction.id, interaction.token, data);
			controller.markReplied();
		},

		async defer(data?: CreateInteractionDeferResponseOptions): Promise<void> {
			await api.interactions.defer(interaction.id, interaction.token, data);
			controller.markDeferred();
		},
```

```ts
		async showModal(data: CreateModalResponseOptions): Promise<void> {
			await api.interactions.createModal(interaction.id, interaction.token, data);
			controller.markReplied();
		},
```

The `controller` is also called externally: `src/context/button.ts:20-28`, `src/context/modal.ts:22-30`, and `src/context/select-menu.ts:21-30` call `controller.markReplied()` / `controller.markDeferred()` after their `update`/`deferUpdate` API calls. Do not change those files (see Out of scope).

### Conventions that apply

- Named exports only; tabs for indentation; relative imports use `.ts` extensions; no comments restating code; strict mode.
- This codebase prefers explicit `if` guards over dense expressions.
- Mock API for tests: `test/fixtures/mock-api.ts` (`createMockAPI()` — every `api.interactions.*` method is a `node:test` `mock.fn`). To make a mock fail once: `api.interactions.reply.mock.mockImplementationOnce(async () => { throw new Error("network"); });`

## Commands you will need

| Purpose        | Command                                               | Expected on success |
| -------------- | ----------------------------------------------------- | ------------------- |
| Typecheck      | `pnpm run build:typecheck`                            | exit 0              |
| All tests      | `pnpm test`                                           | `fail 0`            |
| This test file | `node --test ./test/unit/interaction-context.test.ts` | all pass            |
| Lint           | `pnpm run lint`                                       | exit 0              |
| Auto-format    | `pnpm run fmt`                                        | exit 0              |

## Scope

**In scope** (the only files you should modify):

- `src/context/interaction.ts`
- `test/unit/interaction-context.test.ts` (extend — do not rewrite existing tests)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):

- `src/context/button.ts`, `src/context/modal.ts`, `src/context/select-menu.ts` — their `update`/`deferUpdate` methods have the same mark-after-await ordering, but plan 006 consolidates them into one helper and fixes the ordering there. Fixing them here creates merge conflicts with that plan.
- `src/routing/*` — `sendErrorResponse` calls `ctx.reply` and relies on the followUp delegation; behavior-compatible by design of this change, no edits needed.
- The sequential double-reply contract (second call → followUp) — existing behavior, must keep working.

## Git workflow

- Branch: `advisor/002-interaction-state-reentrancy`
- Commit style: short imperative subject, no prefix (e.g. `Mark interaction state before awaiting acknowledgement calls`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extend the test file with the desired behavior (expect new tests to fail)

Append a new `describe("interaction state re-entrancy", ...)` block to `test/unit/interaction-context.test.ts`, modeled structurally on the existing tests in that file (same imports, `createInteractionContext(api, {} as any, chatInputInteraction("test"))` setup):

1. **`concurrent replies send one initial reply and one follow-up`**: `await Promise.all([ctx.reply({ content: "a" }), ctx.reply({ content: "b" })]);` then assert `api.interactions.reply.mock.callCount() === 1` and `api.interactions.followUp.mock.callCount() === 1`.
2. **`failed initial reply rolls back so a retry replies instead of following up`**: make `reply` reject once (`mockImplementationOnce` throwing `new Error("network")`); `await assert.rejects(ctx.reply({ content: "a" }), { message: "network" });` assert `ctx.replied === false`; then `await ctx.reply({ content: "a" });` and assert `reply` callCount 2, `followUp` callCount 0.
3. **`defer after reply rejects with a descriptive error`**: `await ctx.reply(...)`, then `await assert.rejects(ctx.defer(), { message: /already acknowledged/ });` assert `api.interactions.defer.mock.callCount() === 0`.
4. **`showModal after reply rejects with a descriptive error`**: same shape; assert `createModal` was never called.
5. **`failed defer rolls back both flags`**: make `defer` reject once; `await assert.rejects(ctx.defer());` assert `ctx.deferred === false` and `ctx.replied === false`; then `await ctx.reply(...)` succeeds via the initial-reply path (reply callCount 1, followUp 0).
6. **`failed showModal rolls back`**: make `createModal` reject once; assert rejection, then `ctx.replied === false`.

**Verify**: `node --test ./test/unit/interaction-context.test.ts` → exactly 3 of the new tests fail: test 1 fails because `reply` is called twice, and tests 3 and 4 fail because the calls resolve instead of rejecting with a descriptive error. The rollback tests (2, 5, 6) may already pass on the old implementation because the old code marks state only after the API call succeeds; they still matter after Step 2 because the fix moves marking before the await and must preserve rollback behavior. All 7 pre-existing tests must pass.

### Step 2: Rework the three methods in `src/context/interaction.ts`

Target shape — flags flip synchronously before the await; a failed acknowledgement rolls them back; `defer` and `showModal` guard explicitly:

```ts
		async reply(data: CreateInteractionResponseOptions): Promise<void> {
			if (replied) {
				await api.interactions.followUp(interaction.application_id, interaction.token, data);
				return;
			}
			controller.markReplied();
			try {
				await api.interactions.reply(interaction.id, interaction.token, data);
			} catch (error) {
				replied = false;
				throw error;
			}
		},

		async defer(data?: CreateInteractionDeferResponseOptions): Promise<void> {
			if (replied) {
				throw new Error("Interaction was already acknowledged; defer() must be the first response");
			}
			controller.markDeferred();
			try {
				await api.interactions.defer(interaction.id, interaction.token, data);
			} catch (error) {
				replied = false;
				deferred = false;
				throw error;
			}
		},
```

`showModal` follows the same pattern as `defer`: guard on `replied` with the message `"Interaction was already acknowledged; showModal() must be the first response"`, `controller.markReplied()` before the `createModal` call, rollback `replied = false` on failure.

Leave `followUp`, `editReply`, `deleteReply`, `fetchReply`, the getters, and the `controller` object untouched.

**Verify**: `node --test ./test/unit/interaction-context.test.ts` → all tests pass (13 total: 7 pre-existing + 6 new).

### Step 3: Full gates

Run `pnpm run fmt`, then:

**Verify**: `pnpm run lint` → exit 0. `pnpm run build:typecheck` → exit 0. `pnpm test` → `fail 0` (no other suite regresses — the routers and collector flows exercise `reply` heavily).

## Test plan

Covered by Step 1: six new tests in `test/unit/interaction-context.test.ts`, pattern-matched to the existing tests in the same file. The concurrent-reply test pins the race this plan fixes; the rollback tests pin that error recovery still allows a clean retry; the guard tests pin the new descriptive errors.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm run build:typecheck` exits 0
- [ ] `pnpm run lint` exits 0
- [ ] `pnpm test` exits 0, `fail 0`, ≥ 124 tests when run after plan 001
- [ ] `node --test ./test/unit/interaction-context.test.ts` → 13/13 pass
- [ ] `grep -n "already acknowledged" src/context/interaction.ts` → 2 matches
- [ ] `git status --porcelain` shows changes only to in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts in "Current state" don't match `src/context/interaction.ts` (drifted).
- Any pre-existing test in `test/unit/interaction-context.test.ts` fails after Step 2 — especially `auto-delegates to followUp when already replied` (`:27-37`). That contract must survive.
- An integration test fails after Step 2 (a router path may depend on `defer`-after-reply not throwing — none was found when this plan was written, but if one surfaces, report it rather than weakening the guard).
- You're tempted to serialize concurrent replies with a promise queue to guarantee Discord-side arrival order. Out of scope: flag-before-await fixes the observable double-initial-reply bug; full serialization is a design change.

## Maintenance notes

- After plan 006 extracts `update`/`deferUpdate` into one shared helper, apply this same mark-before-await + rollback pattern there (006 includes that step).
- The new `defer()`/`showModal()` guards turn a Discord 400 into a framework `Error`. This is a behavioral tightening for code that was already broken at runtime; it should be mentioned in the changelog for the next release.
- Reviewer focus: the rollback assigns the closure variables directly (`replied = false`) rather than going through `controller` — the controller deliberately exposes only mark-forward transitions to the routers/contexts.
