# Plan 001: Isolate dispatch errors — event handlers run even when an interaction handler throws, and fallback-response failures no longer mask the original error

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6ec7a23..HEAD -- src/bot.ts src/routing/shared.ts src/routing/interaction-router.ts README.md test/integration/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6ec7a23`, 2026-06-11

## Why this matters

`@almeidx/discore` is a published Discord bot framework. Its documented error contract (README "Error handling") is: send a fallback error response, then rethrow the handler's error. Today that rethrow has two unintended side effects. First, because the gateway dispatch listener awaits interaction routing _before_ event dispatch, a throwing interaction handler silently prevents every `defineEvent` handler registered for `InteractionCreate` from running for that payload — unrelated user code is starved by someone else's bug. Second, if the fallback error response itself fails (expired interaction token, network error, a throwing user-supplied `errorResponse` function), that secondary failure propagates _instead of_ the original handler error, so the developer debugs the wrong error. This plan fixes both while preserving the documented "errors are surfaced" contract, and documents in the README exactly where surfaced errors land.

## Current state

This is a TypeScript-strict, ESM-only library (Node >= 24 runs `.ts` natively; pnpm; tests use the built-in `node:test` runner). Relevant files:

- `src/bot.ts` — `createBot` wires gateway events to routers; contains `dispatchListener` (the bug site for the skip).
- `src/routing/shared.ts` — `sendErrorResponse` helper used by both the interaction and component routers (the bug site for the masking).
- `src/routing/interaction-router.ts` — command/autocomplete routing; the autocomplete error path has its own masking variant.
- `src/routing/component-router.ts` — calls `sendErrorResponse` too, but needs **no change** (the masking fix in `shared.ts` covers it).
- `test/fixtures/mock-gateway.ts` — `MockGateway` (plain `EventEmitter` with a `dispatch(event, data, shardId)` helper).
- `README.md` — "Error handling" section to be extended.

### The skip — `src/bot.ts:130-136` (registration at `:145`)

```ts
async function dispatchListener(payload: GatewayDispatchPayload, shardId: number) {
	if (payload.t === GatewayDispatchEvents.InteractionCreate) {
		await interactionRouter.handle(api, gateway, payload.d);
	}

	await eventRouter.dispatch(payload.t, payload.d, api, gateway, shardId);
}
```

If `interactionRouter.handle` throws (it rethrows unsuppressed handler errors by design), line 135's `eventRouter.dispatch` never runs for that payload.

### The masking — `src/routing/shared.ts:13-24`

```ts
export async function sendErrorResponse(
	errorResponse: ErrorResponseOption,
	ctx: InteractionContext,
	error: unknown,
): Promise<void> {
	const response = errorResponse === undefined ? defaultErrorResponse : errorResponse;
	if (response === null) return;

	const data = typeof response === "function" ? response(ctx, error) : response;

	await ctx.reply(data);
}
```

Its two call sites both have the shape `await sendErrorResponse(...); throw error;` — `src/routing/interaction-router.ts:146-147` and `src/routing/component-router.ts:52-53`. If `sendErrorResponse` rejects (or the user's `errorResponse` function throws synchronously at line 21), the `throw error` line is never reached and the secondary failure replaces the original.

### The autocomplete variant — `src/routing/interaction-router.ts:249-261`

```ts
					} catch (error) {
						let suppressed = false;
						if (hooks.onError) {
							const result = await hooks.onError(ctx, error);
							if (result === false) suppressed = true;
						}
						if (!suppressed && !hasResponded()) {
							await ctx.respond([]);
						}
						if (!suppressed) {
							throw error;
						}
					}
```

If `ctx.respond([])` rejects, it masks the original handler error the same way.

### Where the rethrow lands (for the README step)

`dispatchListener` is registered via `gateway.on(WebSocketShardEvents.Dispatch, dispatchListener)` (`src/bot.ts:145`). The real `WebSocketManager` from `@discordjs/ws` extends `AsyncEventEmitter` (`@vladfrangu/async_event_emitter`), whose rejection capture is **conditional**: when capture is off (the default), a listener rejection is left as an unhandled promise rejection — which terminates a Node.js process by default; when capture is on, it is re-emitted as an `'error'` event on the manager. Either way, an unsuppressed handler error escalates to a process-level failure unless the bot author handles it. This was verified against `@vladfrangu/async_event_emitter@2.4.7` (`handleMaybeAsync` returns early unless `kCapturePromiseRejections` is set). This plan does NOT change that contract — it documents it.

### Conventions that apply

- Named exports only; kebab-case file names; relative imports use the `.ts` extension; tabs for indentation; no classes in `src/`; no comments that restate what the code does.
- The aggregate-error pattern to follow already exists in `src/routing/event-router.ts:73-77`:

```ts
if (errors.length === 1) {
	throw errors[0];
} else if (errors.length > 1) {
	throw new AggregateError(errors, "Multiple event handlers failed");
}
```

## Commands you will need

| Purpose                                  | Command                                                 | Expected on success                                    |
| ---------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| Install (only if `node_modules` missing) | `pnpm install --frozen-lockfile`                        | exit 0                                                 |
| Typecheck                                | `pnpm run build:typecheck`                              | exit 0, no output after the `tsc` line                 |
| All tests                                | `pnpm test`                                             | `pass 112` at baseline; more after this plan; `fail 0` |
| One test file                            | `node --test ./test/integration/dispatch-error.test.ts` | all pass                                               |
| Lint + format check                      | `pnpm run lint`                                         | exit 0                                                 |
| Auto-format                              | `pnpm run fmt`                                          | exit 0                                                 |

## Scope

**In scope** (the only files you should modify/create):

- `src/bot.ts` (only the `dispatchListener` function)
- `src/routing/shared.ts` (only `sendErrorResponse`)
- `src/routing/interaction-router.ts` (only the `ctx.respond([])` call inside `handleAutocomplete`'s catch block)
- `README.md` (only the "Error handling" section)
- `test/integration/dispatch-error.test.ts` (create)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):

- `src/routing/component-router.ts` — its masking goes through `sendErrorResponse`, which step 3 fixes centrally.
- `src/routing/event-router.ts` — its rethrow/AggregateError behavior is correct and pinned by existing tests.
- The rethrow itself (`throw error` in either router) — surfacing errors is the documented contract; do not swallow them.
- `src/context/*`, `src/collectors/*` — separate plans cover those.
- Adding new hook types (e.g. a global `onDispatchError`) — explicitly deferred, see Maintenance notes.

## Git workflow

- Branch: `advisor/001-dispatch-error-isolation`
- Commit style: short imperative subject, no prefix (matches repo history, e.g. `Propagate handler errors after fallback responses`). One commit for the tests, one for the fix, is fine; a single commit is also fine.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the regression tests (expect them to fail)

Create `test/integration/dispatch-error.test.ts`. Existing integration tests (`test/integration/command-flow.test.ts`) dispatch through `MockGateway.dispatch(...)` and then sleep — do **not** use that pattern here: `MockGateway` is a plain `EventEmitter`, so a rejecting listener would become an unhandled rejection and kill the test run. Instead, grab the registered listener and await it directly:

```ts
import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { WebSocketShardEvents } from "@discordjs/ws";
import { GatewayDispatchEvents, type GatewayDispatchPayload } from "discord-api-types/v10";
import { createBot } from "../../src/bot.ts";
import { defineCommand } from "../../src/definitions/command.ts";
import { defineEvent } from "../../src/definitions/event.ts";
import { chatInputInteraction } from "../fixtures/interactions.ts";
import { createMockREST } from "../fixtures/mock-api.ts";
import { createMockGateway } from "../fixtures/mock-gateway.ts";

function getDispatchListener(gateway: ReturnType<typeof createMockGateway>) {
	const listeners = gateway.listeners(WebSocketShardEvents.Dispatch);
	assert.strictEqual(listeners.length, 1);
	return listeners[0] as (payload: GatewayDispatchPayload, shardId: number) => Promise<void>;
}

function interactionPayload(data: unknown): GatewayDispatchPayload {
	return { t: GatewayDispatchEvents.InteractionCreate, d: data, op: 0, s: 1 } as GatewayDispatchPayload;
}
```

Note: `createBot` does not return the listener; `getDispatchListener` must be called after `createBot` so the listener is registered. The `rest` option accepts `createMockREST()` (cast with `as any` like the existing integration tests do). To make the framework's fallback error response fail in tests 4–5, override the relevant mock from `createMockAPI` — but note `createBot` constructs its own `API` from `rest`. Instead, for those two tests construct the failure at the `rest` level is NOT possible cheaply; use the unit-level router instead, exactly like `test/unit/interaction-router.test.ts:99-127` does (it builds `createInteractionRouter` directly with `createMockAPI()`), and make `api.interactions.reply` reject. Model the router construction on that excerpt.

Write these six tests:

1. **`event handlers still run when an interaction handler throws`** (bot-level): a `defineCommand` whose handler throws `new Error("boom")`, plus a `defineEvent({ event: GatewayDispatchEvents.InteractionCreate, handler })` with a `mock.fn`. Call the listener with `interactionPayload(chatInputInteraction("test"))`; `await assert.rejects(..., { message: "boom" })`; then `assert.strictEqual(eventHandler.mock.callCount(), 1)`.
2. **`interaction handlers still run when an event handler throws`** (bot-level): inverse — the event handler throws, the command handler succeeds. Assert the listener rejects with the event handler's error and the command handler ran.
3. **`both failing produces an AggregateError carrying both errors`** (bot-level): both throw distinct messages; `await assert.rejects(listener(...), AggregateError)`; additionally catch it and assert `error.errors.length === 2`.
4. **`original handler error propagates when the fallback error response fails`** (router-level, per the note above): command handler throws `"boom"`; `api.interactions.reply` mock rejects with `"reply failed"`. `await assert.rejects(router.handle(api, {} as any, chatInputInteraction("test")), { message: "boom" })`.
5. **`original autocomplete error propagates when the empty-choices response fails`** (router-level): an autocomplete definition (see the shape used at `test/unit/interaction-router.test.ts:422-431` — a plain object with `type: DefinitionType.Autocomplete, command: "search", option: "query", handler`) whose handler throws `"boom"`; make `api.interactions.createAutocompleteResponse` reject. Assert `router.handle(...)` rejects with `"boom"`.
6. **`success path is unchanged and ordered`** (bot-level): command handler and `InteractionCreate` event handler both push to a shared `order` array (`"interaction"` / `"event"`); listener resolves; `assert.deepStrictEqual(order, ["interaction", "event"])`.

To make a `node:test` mock reject: `api.interactions.reply.mock.mockImplementation(async () => { throw new Error("reply failed"); });`

**Verify**: `node --test ./test/integration/dispatch-error.test.ts` → tests 1, 3, 4, 5 FAIL (test 1 fails on the callCount assertion; 4 and 5 reject with the wrong message; 3 rejects with a plain Error, not AggregateError); tests 2 and 6 already pass. If a different subset fails, STOP — your understanding of current behavior is wrong.

### Step 2: Fix the skip in `src/bot.ts`

Replace the body of `dispatchListener` (currently `src/bot.ts:130-136`) with sequential, independently-caught stages. Sequential on purpose — interaction handlers must still run before event handlers (pinned by test 6):

```ts
async function dispatchListener(payload: GatewayDispatchPayload, shardId: number) {
	const errors: unknown[] = [];

	if (payload.t === GatewayDispatchEvents.InteractionCreate) {
		try {
			await interactionRouter.handle(api, gateway, payload.d);
		} catch (error) {
			errors.push(error);
		}
	}

	try {
		await eventRouter.dispatch(payload.t, payload.d, api, gateway, shardId);
	} catch (error) {
		errors.push(error);
	}

	if (errors.length === 1) {
		throw errors[0];
	} else if (errors.length > 1) {
		throw new AggregateError(errors, "Dispatch failed");
	}
}
```

**Verify**: `node --test ./test/integration/dispatch-error.test.ts` → tests 1, 2, 3, 6 pass; 4 and 5 still fail.

### Step 3: Fix the masking in `src/routing/shared.ts`

In `sendErrorResponse`, wrap the response computation and send so its failure never replaces the handler error (the callers do `await sendErrorResponse(...); throw error;`):

```ts
export async function sendErrorResponse(
	errorResponse: ErrorResponseOption,
	ctx: InteractionContext,
	error: unknown,
): Promise<void> {
	const response = errorResponse === undefined ? defaultErrorResponse : errorResponse;
	if (response === null) return;

	try {
		const data = typeof response === "function" ? response(ctx, error) : response;
		await ctx.reply(data);
	} catch {
		// the original handler error must propagate; a failed fallback response is secondary
	}
}
```

**Verify**: `node --test ./test/integration/dispatch-error.test.ts` → test 4 now passes; only test 5 fails.

### Step 4: Fix the autocomplete masking in `src/routing/interaction-router.ts`

In `handleAutocomplete`'s catch block, guard the empty-choices response (currently `:255-257`):

```ts
if (!suppressed && !hasResponded()) {
	try {
		await ctx.respond([]);
	} catch {
		// the original handler error must propagate
	}
}
```

**Verify**: `node --test ./test/integration/dispatch-error.test.ts` → all 6 pass.

### Step 5: Document where surfaced errors land in `README.md`

The "Error handling" section currently reads (README.md:57-59):

> Handler errors are surfaced by default. Discore sends the configured error response, or empty autocomplete choices for autocomplete handlers, then rethrows the original error. Return `false` from an `onError` hook only when the hook has handled the error and should suppress both the fallback response and the rethrow.

Append this paragraph to that section, verbatim:

> The rethrown error rejects the gateway dispatch listener. By default that becomes an unhandled promise rejection, which terminates a Node.js process — register an `onError` hook that returns `false`, a `process.on("unhandledRejection")` handler, or enable `captureRejections` on the `WebSocketManager` and listen to its `error` event if you want the bot to keep running. An error thrown by one handler no longer prevents other handlers (such as `defineEvent` handlers for the same gateway payload) from running; when several handlers fail on one payload, the rejection is an `AggregateError`.

**Verify**: `grep -c "AggregateError" README.md` → `1`.

### Step 6: Full gates

Run `pnpm run fmt`, then all three gates.

**Verify**: `pnpm run lint` → exit 0. `pnpm run build:typecheck` → exit 0. `pnpm test` → `fail 0`, total ≥ 118 (112 baseline + 6 new).

## Test plan

Covered by Step 1 (six tests in `test/integration/dispatch-error.test.ts`; structural pattern: router-level error tests follow `test/unit/interaction-router.test.ts:99-127`, bot-level tests follow `test/integration/command-flow.test.ts` minus the sleeps). The regression each test pins is named in Step 1.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm run build:typecheck` exits 0
- [ ] `pnpm run lint` exits 0
- [ ] `pnpm test` exits 0 with `fail 0` and ≥ 118 tests
- [ ] `node --test ./test/integration/dispatch-error.test.ts` → 6/6 pass
- [ ] `grep -n "AggregateError" src/bot.ts` returns a match (the aggregation exists)
- [ ] `git status --porcelain` shows changes only to the in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows changes to `src/bot.ts`, `src/routing/shared.ts`, or `src/routing/interaction-router.ts` since `6ec7a23`, or the excerpts above don't match what you see.
- In Step 1, a different subset of the six tests fails than predicted — current behavior differs from this plan's analysis.
- Any _existing_ test fails after Step 2–4 (e.g. a test depended on `sendErrorResponse` rejecting). Do not modify existing tests to make them pass; report instead.
- You find yourself wanting to remove the `throw error` in either router — that's a contract change, not this plan.

## Maintenance notes

- **Deferred on purpose**: a global `onDispatchError` hook (so bot authors get a structured landing spot instead of `unhandledRejection`). It's additive API surface and pairs naturally with plan 007 (hook parity); revisit after 007 lands.
- Reviewer focus: the `catch {}` blocks in steps 3–4 intentionally swallow the _secondary_ failure. If the project later adds debug logging/diagnostics, those catches are where a `debug()` call belongs.
- Plan 003 edits other sections of `README.md`; merge conflicts there are textual only.
- `MockGateway` (plain `EventEmitter`) diverges from the real `AsyncEventEmitter` gateway in how listener rejections propagate. Tests in this plan sidestep that by awaiting the listener directly; if someone later "fixes" tests to dispatch via `emit`, rejections will escape again.
