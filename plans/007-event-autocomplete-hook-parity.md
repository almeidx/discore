# Plan 007: Give events and autocomplete handlers per-definition `onError` hooks, matching every other definition type

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 325c507..HEAD -- src/types/definitions.ts src/types/hooks.ts src/definitions/event.ts src/definitions/autocomplete.ts src/routing/event-router.ts src/routing/interaction-router.ts`
> Plan 001 has landed (it edited `src/bot.ts` and the autocomplete catch block
> in `src/routing/interaction-router.ts`). If the autocomplete catch block
> differs from plan 001's post-state shape, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-dispatch-error-isolation.md
- **Category**: direction (capability parity)
- **Planned at**: commit `325c507`, 2026-06-16

## Why this matters

Every definition type in discore can attach error handling to itself — except two. Commands, command groups, user commands, and message commands take `hooks?: CommandHooks`; buttons, select menus, and modals take `hooks?: HandlerHooks<TContext>` (`src/types/definitions.ts:43,51,66,73,80,97,105`). But `EventDefinition` (`:55-61`) and `AutocompleteDefinition` (`:84-89`) have no `hooks` field at all: an event handler that needs custom retry/reporting must rely on the _global_ `onEventError`, and an autocomplete handler only gets the global `onError`. This is a capability gap, not a redesign: the `HandlerHooks<TContext>` shape, the define-function passthrough, and the def-before-global error ordering all already exist in this codebase — this plan extends the established pattern to the two missing definition types.

## Current state

TypeScript-strict, ESM-only library; pnpm; `node:test`. Conventions: named exports, `.ts` import extensions, tabs, functional factories, JSDoc on public types.

### The hook shape to reuse — `src/types/hooks.ts:23-29`

```ts
/**
 * Per-handler hooks for component interaction handlers (buttons, select menus, modals).
 */
export interface HandlerHooks<TContext> {
	/** Runs when the handler throws. Return `false` after handling the error to skip the default response and prevent rethrow. */
	onError?: (ctx: TContext, error: unknown) => Promise<boolean | void> | boolean | void;
}
```

### The definitions missing hooks — `src/types/definitions.ts:55-61` and `:84-89`

```ts
export interface EventDefinition {
	type: typeof DefinitionType.Event;
	event: GatewayDispatchEvents;
	priority: number;
	once?: boolean;
	handler: (ctx: EventContext) => void | Promise<void>;
}
```

```ts
export interface AutocompleteDefinition {
	type: typeof DefinitionType.Autocomplete;
	command: string | [string, string] | [string, string, string];
	option: string;
	handler: (ctx: AutocompleteContext) => void | Promise<void>;
}
```

### The define functions to extend

`src/definitions/event.ts` (entire file today):

```ts
export interface DefineEventConfig<E extends GatewayDispatchEvents> {
	event: E;
	priority?: number;
	once?: boolean;
	handler: (ctx: EventContext<GatewayEventData<E>>) => void | Promise<void>;
}

export function defineEvent<E extends GatewayDispatchEvents>(config: DefineEventConfig<E>): EventDefinition {
	return {
		type: DefinitionType.Event,
		event: config.event,
		priority: config.priority ?? 0,
		once: config.once,
		handler: config.handler as EventDefinition["handler"],
	};
}
```

`src/definitions/autocomplete.ts` has the same passthrough shape (config interface + literal return). The passthrough exemplar that already carries hooks is `src/definitions/button.ts:5-19` (`hooks?: HandlerHooks<ButtonContext>` in config, `hooks: config.hooks` in the returned object).

### The event router error path — `src/routing/event-router.ts:52-77`

```ts
for (const def of handlers) {
	if (def.once) {
		removeFromMap(def);
	}

	const ctx = createEventContext(api, gateway, data, shardId);
	try {
		await def.handler(ctx);
	} catch (error) {
		if (hooks.onEventError) {
			try {
				await hooks.onEventError(ctx, error);
			} catch (hookError) {
				errors.push(hookError);
			}
		} else {
			errors.push(error);
		}
	}
}
```

(Global `onEventError` semantics today: its presence means "handled" — the original error is not collected; only a throwing hook is. Preserve that.)

### The autocomplete error path — `src/routing/interaction-router.ts:244-264` (pre-plan-001 shape)

```ts
		try {
			for (const def of autocompletes) {
				if (matchesAutocomplete(def, ctx) && def.option === ctx.focused.name) {
					try {
						await def.handler(ctx);
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
					return;
				}
			}
```

(Plan 001 wraps the `ctx.respond([])` in a try/catch; everything else is unchanged.)

Plan refresh note, 2026-06-16: plans 001-006 have landed. The autocomplete
catch block already includes plan 001's fallback-response try/catch, and the
hook-related files remain unchanged relative to the plan. Full-suite baseline:
183 tests passing.

The error-ordering convention to match (def-level before global) is established in `src/routing/component-router.ts:41-50` and the command pipeline `src/routing/interaction-router.ts:140-148` (command → group → global).

### Existing tests to model on

- `test/unit/event-router.test.ts` — constructs `EventDefinition` literals (`{ type: DefinitionType.Event, event: GatewayDispatchEvents.MessageCreate, priority: 0, handler }`) and calls `router.dispatch(event, data, api, {} as any, 0)`.
- `test/unit/interaction-router.test.ts:414-448` — the autocomplete error test (definition literal + `autocompleteInteraction("search", { name: "query", value: "x", type: 3 })` fixture + `assert.rejects`).
- `test/unit/hooks.test.ts` — hook ordering/suppression patterns.

## Commands you will need

| Purpose      | Command                                                                               | Expected on success |
| ------------ | ------------------------------------------------------------------------------------- | ------------------- |
| Typecheck    | `pnpm run build:typecheck`                                                            | exit 0              |
| Router tests | `node --test ./test/unit/event-router.test.ts ./test/unit/interaction-router.test.ts` | 0 fail              |
| All tests    | `pnpm test`                                                                           | `fail 0`            |
| Lint         | `pnpm run lint`                                                                       | exit 0              |
| Auto-format  | `pnpm run fmt`                                                                        | exit 0              |

## Scope

**In scope**:

- `src/types/definitions.ts` (add `hooks?` to the two interfaces)
- `src/types/hooks.ts` (JSDoc wording only)
- `src/definitions/event.ts`, `src/definitions/autocomplete.ts` (config + passthrough)
- `src/routing/event-router.ts`, `src/routing/interaction-router.ts` (consult def-level hook first)
- `test/unit/event-router.test.ts`, `test/unit/interaction-router.test.ts` (new tests)
- `README.md` (one-line hooks feature bullet update)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):

- `CommandHooks`, the command pipeline's hook ordering, `beforeCommand`/`afterCommand` — events/autocomplete get **only** `onError` (the `HandlerHooks` shape). Adding before/after lifecycle hooks to events is a separate design discussion.
- Global `GlobalHooks.onEventError` semantics — unchanged, still runs when the def-level hook didn't suppress.
- `src/bot.ts`, `src/guards.ts`, contexts, collectors.

## Git workflow

- Branch: `advisor/007-event-autocomplete-hook-parity`
- Commit style: short imperative subject (e.g. `Add per-definition onError hooks to events and autocomplete`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extend the types

In `src/types/definitions.ts`: add `hooks?: HandlerHooks<EventContext>;` to `EventDefinition` (after `once?`) and `hooks?: HandlerHooks<AutocompleteContext>;` to `AutocompleteDefinition` (after `option`). `HandlerHooks` is already imported in that file (`:17`).

In `src/types/hooks.ts`: change the `HandlerHooks` JSDoc first line to `Per-handler hooks for component, event, and autocomplete handlers.` and, on the `onError` member doc, append: `For events, returning \`false\` marks the error handled and skips the global \`onEventError\` hook and rethrow.`

**Verify**: `pnpm run build:typecheck` → exit 0.

### Step 2: Thread hooks through the define functions

`src/definitions/event.ts`: add `hooks?: HandlerHooks<EventContext<GatewayEventData<E>>>;` to `DefineEventConfig` and `hooks: config.hooks as EventDefinition["hooks"],` to the returned literal (the cast mirrors the existing `handler` cast on the line below it — same generic-erasure reason). Import `HandlerHooks` type from `../types/hooks.ts`.

`src/definitions/autocomplete.ts`: add `hooks?: HandlerHooks<AutocompleteContext>;` to `DefineAutocompleteConfig` and `hooks: config.hooks,` to the literal (no cast needed — not generic). Import `HandlerHooks`.

**Verify**: `pnpm run build:typecheck` → exit 0.

### Step 3: Consult the def-level hook in the event router

In `src/routing/event-router.ts`, replace the catch block (`:60-70` in the excerpt above) with def-first ordering. Target shape:

```ts
				} catch (error) {
					let suppressed = false;
					if (def.hooks?.onError) {
						try {
							if ((await def.hooks.onError(ctx, error)) === false) suppressed = true;
						} catch (hookError) {
							errors.push(hookError);
						}
					}
					if (suppressed) continue;
					if (hooks.onEventError) {
						try {
							await hooks.onEventError(ctx, error);
						} catch (hookError) {
							errors.push(hookError);
						}
					} else {
						errors.push(error);
					}
				}
```

Semantics this encodes (and the tests pin): def-level `onError` returning `false` → error fully handled, global hook not called, nothing collected; def-level hook present but not returning `false` → global path proceeds exactly as today; def-level hook throwing → its error is collected AND the global path still proceeds with the original error.

### Step 4: Consult the def-level hook in the autocomplete path

In `src/routing/interaction-router.ts`'s `handleAutocomplete` catch block, before the global check, insert:

```ts
let suppressed = false;
if (def.hooks?.onError) {
	const result = await def.hooks.onError(ctx, error);
	if (result === false) suppressed = true;
}
if (!suppressed && hooks.onError) {
	const result = await hooks.onError(ctx, error);
	if (result === false) suppressed = true;
}
```

(i.e. replace the existing `let suppressed = false; if (hooks.onError) {...}` opening with the def-first version; keep the rest of the block — the `hasResponded()` empty-respond guard from plan 001 and the rethrow — unchanged.)

**Verify (covers steps 3–4)**: `pnpm run build:typecheck` → exit 0; `node --test ./test/unit/event-router.test.ts ./test/unit/interaction-router.test.ts` → 0 fail (existing global-hook tests must still pass — they pin the no-def-hook path).

### Step 5: Tests

Add to `test/unit/event-router.test.ts` (definition literals now also carry `hooks`):

1. **`per-event onError runs before the global onEventError`**: both hooks record into an `order` array; def hook does NOT return false; assert order `["def", "global"]` and `dispatch` resolves.
2. **`per-event onError returning false suppresses the global hook and the rethrow`**: def hook returns `false`; global `onEventError` is a `mock.fn`; assert dispatch resolves, global callCount 0.
3. **`per-event onError returning false with no global hook prevents the rethrow`**: no global hooks at all; handler throws; assert `await router.dispatch(...)` resolves (today an uncaught handler error rejects).
4. **`throwing per-event onError is collected alongside the global path`**: def hook throws `"hook boom"`, no global hook; assert dispatch rejects with an `AggregateError` (or single error — match the router's 1-vs-many logic: handler error + hook error = 2 collected → AggregateError with both messages).

Add to `test/unit/interaction-router.test.ts` (model on the existing autocomplete error test at `:414-448`):

5. **`autocomplete def-level onError runs before the global hook`**: order assertion as in test 1; still rethrows (neither returned false).
6. **`autocomplete def-level onError returning false suppresses the empty response and rethrow`**: assert `router.handle(...)` resolves and `api.interactions.createAutocompleteResponse.mock.callCount() === 0`.

**Verify**: `node --test ./test/unit/event-router.test.ts ./test/unit/interaction-router.test.ts` → 0 fail, including 6 new tests.

### Step 6: Document

`README.md` Features list, hooks bullet (line 11 at planning time) — change to:

`- **Hooks** — Per-command and global \`beforeCommand\`/\`afterCommand\`/\`onError\` hooks; per-definition \`onError\` on components, events, and autocomplete.`

**Verify**: `grep -n "per-definition" README.md` → 1 match.

### Step 7: Full gates

Run `pnpm run fmt`, then:

**Verify**: `pnpm run lint` → exit 0. `pnpm run build:typecheck` → exit 0. `pnpm test` → `fail 0`.

## Test plan

Step 5 (six tests). Patterns: `test/unit/event-router.test.ts` definition literals; `test/unit/interaction-router.test.ts:414-448` for autocomplete; `test/unit/hooks.test.ts` for ordering-array assertions.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "hooks?: HandlerHooks" src/types/definitions.ts` → 5 matches (3 existing + events + autocomplete)
- [ ] `grep -n "def.hooks?.onError" src/routing/event-router.ts src/routing/interaction-router.ts` → ≥ 1 match in each
- [ ] `node --test ./test/unit/event-router.test.ts ./test/unit/interaction-router.test.ts` → 0 fail
- [ ] `pnpm test` exits 0, `fail 0`
- [ ] `pnpm run build:typecheck` and `pnpm run lint` exit 0
- [ ] `git status --porcelain` shows only in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The event-router catch block or autocomplete catch block doesn't match either the excerpts above or plan 001's documented post-state.
- Existing tests in `test/unit/event-router.test.ts` fail after Step 3 — the global-only semantics must be byte-compatible when no def-level hook exists.
- The `DefineEventConfig` hook typing fights the generic (`EventContext<GatewayEventData<E>>` vs `EventDefinition`'s plain `EventContext`) beyond the single documented cast — report rather than stacking casts.
- You're tempted to add `beforeEvent`/`afterEvent` while in there — explicitly out of scope.

## Maintenance notes

- This creates the natural seam for a future global `onDispatchError` (deferred from plan 001) — def-level, then global, then dispatch-level would be the full ladder.
- Changelog-worthy: new optional fields on two public interfaces (backward compatible — old definition objects remain valid).
- Reviewer focus: the suppression contract for events ("false = fully handled, skip global, collect nothing") is new surface — the JSDoc in `src/types/hooks.ts` and test 3 must agree exactly.
