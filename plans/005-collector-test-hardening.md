# Plan 005: Harden collector tests — mocked timers instead of real waits, full `awaitModal` unit coverage, and the missing `collectComponents` timeout case

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6ec7a23..HEAD -- src/collectors/ test/unit/collectors.test.ts test/fixtures/`
> If any of these changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `6ec7a23`, 2026-06-11

## Why this matters

Collector timeouts are tested with real timers today: `test/unit/collectors.test.ts:62-70` really waits 50ms and trusts the event loop to be prompt — a flake risk on loaded CI runners and dead time in every run. Worse, two timeout paths are completely untested: `awaitModal` (`src/collectors/await-modal.ts`) has **zero unit tests** (only a happy-path integration test), and `collectComponents`' `"timeout"` end-reason is never exercised (only `"max"` and `"manual"` are). Node's built-in test runner has first-class mock timers (`t.mock.timers`), so these paths can be tested deterministically and instantly. This also creates the safety net plan 006 needs before it refactors the collector internals. A dead test fixture (`messageCreateEvent`, referenced by nothing) is removed along the way.

## Current state

TypeScript-strict, ESM-only library; pnpm; Node >= 24; built-in `node:test` runner (which includes `t.mock.timers` — enable per-test via the test context so restoration is automatic).

- `src/collectors/await-component.ts` — Promise-based collector; `setTimeout` at `:11-14` rejects with `CollectorTimeoutError` and unregisters. **Read-only for this plan.**
- `src/collectors/await-modal.ts` — structurally identical to await-component but for `ModalContext`; currently has no unit test at all. **Read-only.**
- `src/collectors/collect-components.ts` — async-iterator collector; `const timer = setTimeout(() => end("timeout"), options.timeout);` at `:41`; `end()` resolves all `pending` iterator promises with `{ done: true }` and fires `options.onEnd(collected, reason)`. **Read-only.**
- `test/unit/collectors.test.ts` — the file to extend/modify. The real-timer test to convert (`:62-70`):

```ts
it("rejects on timeout", async () => {
	const store = createCollectorStore<ComponentInteractionContext>();
	const promise = awaitComponent(store, {
		filter: () => true,
		timeout: 50,
	});

	await assert.rejects(promise, CollectorTimeoutError);
});
```

- Existing helper in the same file (`:12-14`):

```ts
function fakeButtonCtx(customId: string) {
	return createButtonContext(createMockAPI() as any, {} as any, buttonInteraction(customId), {});
}
```

- For modal contexts there is no helper yet; build one from existing pieces: `createModalContext` (`src/context/modal.ts`, signature `(api, gateway, interaction, params)`) + `modalSubmitInteraction(customId, fields)` from `test/fixtures/interactions.ts` (fields example: `[{ custom_id: "name", value: "hello" }]`).
- `awaitModal(store, options)` is exported from `src/collectors/await-modal.ts`; the store type is `CollectorStore<ModalContext>` (`ModalContext` from `src/types/contexts.ts`).
- Dead fixture: `test/fixtures/gateway-events.ts` exports only `messageCreateEvent()`, and `grep -rn "messageCreateEvent" test/` matches only its own definition (verified at planning time). `grep -rn "gateway-events" test/ src/` should also return nothing besides the file itself — re-verify before deleting.
- Out-of-scope context: `test/integration/collector-flow.test.ts` uses real `setTimeout(..., 10)` dispatches and 200ms sleeps. Leave it alone (see Out of scope).

### node:test mock-timer usage (the pattern to follow)

```ts
it("rejects on timeout", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const store = createCollectorStore<ComponentInteractionContext>();
	const promise = awaitComponent(store, { filter: () => true, timeout: 50 });
	const assertion = assert.rejects(promise, CollectorTimeoutError);
	t.mock.timers.tick(50);
	await assertion;
});
```

Two rules: attach the `assert.rejects(...)` expectation **before** ticking (otherwise the rejection is momentarily unhandled), and enable timers via the test context `t` (auto-restores after the test; never use `mock.timers` from the module-level import for enable/restore).

### Conventions that apply

- Named imports with `.ts` extensions; tabs; `describe`/`it`; `assert` from `node:assert/strict`.

## Commands you will need

| Purpose        | Command                                      | Expected on success |
| -------------- | -------------------------------------------- | ------------------- |
| This test file | `node --test ./test/unit/collectors.test.ts` | all pass            |
| All tests      | `pnpm test`                                  | `fail 0`            |
| Typecheck      | `pnpm run build:typecheck`                   | exit 0              |
| Lint           | `pnpm run lint`                              | exit 0              |
| Auto-format    | `pnpm run fmt`                               | exit 0              |

## Scope

**In scope**:

- `test/unit/collectors.test.ts` (modify the one real-timer test; add new tests)
- `test/fixtures/gateway-events.ts` (delete the file)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):

- Everything under `src/collectors/` — this is a test-only plan; if a test reveals a production bug, STOP and report.
- `test/integration/collector-flow.test.ts` — its real-timer sleeps interact with the full bot dispatch pipeline; converting it to mock timers is a separate, riskier change (deliberately deferred — see Maintenance notes).
- The other passing tests in `test/unit/collectors.test.ts` that use `timeout: 5000` but resolve before the timer fires — they don't wait in real time and need no conversion.

## Git workflow

- Branch: `advisor/005-collector-test-hardening`
- Commit style: short imperative subject (e.g. `Use mocked timers and cover awaitModal in collector tests`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Convert the real-timer timeout test

Replace the body of `rejects on timeout` (`test/unit/collectors.test.ts:62-70`) with the mock-timer pattern shown in Current state.

**Verify**: `node --test ./test/unit/collectors.test.ts` → all pass, and the suite's reported `duration_ms` for this file drops well below the previous ~50ms floor for that test (sanity signal, not a hard gate).

### Step 2: Add `awaitModal` unit tests

Add a `describe("awaitModal", ...)` block with a local helper:

```ts
function fakeModalCtx(customId: string) {
	return createModalContext(createMockAPI() as any, {} as any, modalSubmitInteraction(customId, []), {});
}
```

Tests:

1. **`resolves when a matching modal arrives`**: store + `awaitModal(store, { filter: (ctx) => ctx.customId === "feedback", timeout: 5000 })`; `store.dispatch(fakeModalCtx("feedback"))`; await and assert `result.customId === "feedback"`.
2. **`rejects on timeout`**: mock-timer pattern, `CollectorTimeoutError`.
3. **`unregisters after resolving`**: after a successful await, `store.dispatch(fakeModalCtx("feedback"))` again and assert it returns `false` (nothing handled it).
4. **`unregisters after timeout`**: mock timers; after the rejection settles, dispatch a matching ctx and assert `dispatch` returns `false`.

**Verify**: `node --test ./test/unit/collectors.test.ts` → all pass including 4 new awaitModal cases.

### Step 3: Add the `collectComponents` timeout-end test

In the existing `describe("collectComponents", ...)` block:

```ts
it("ends with timeout reason and completes pending iterations", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const store = createCollectorStore<ComponentInteractionContext>();
	let endReason: string | undefined;

	const collector = collectComponents(store, {
		filter: () => true,
		timeout: 1000,
		onEnd: (_, reason) => {
			endReason = reason;
		},
	});

	const pendingNext = collector.next();
	t.mock.timers.tick(1000);

	const result = await pendingNext;
	assert.strictEqual(result.done, true);
	assert.strictEqual(endReason, "timeout");
});
```

Also add the symmetric `awaitComponent` unregister-after-timeout case if not already present (mirror of Step 2 test 4, using `fakeButtonCtx`).

**Verify**: `node --test ./test/unit/collectors.test.ts` → all pass.

### Step 4: Delete the dead fixture

Re-verify it's unreferenced, then delete:

```sh
grep -rn "gateway-events\|messageCreateEvent" src/ test/ examples/
```

Expected: matches only inside `test/fixtures/gateway-events.ts` itself. Then delete that file.

**Verify**: `pnpm test` → `fail 0` (nothing imported it).

### Step 5: Full gates

Run `pnpm run fmt`, then:

**Verify**: `pnpm run lint` → exit 0. `pnpm run build:typecheck` → exit 0. `pnpm test` → `fail 0`, total ≥ 118 (112 baseline + ≥ 6 new).

## Test plan

This plan is itself the test plan; structural pattern is the existing `test/unit/collectors.test.ts` blocks plus the mock-timer pattern documented in Current state. Cases: awaitComponent timeout (converted to deterministic), awaitModal happy/timeout/unregister×2, collectComponents timeout end-reason, awaitComponent unregister-after-timeout.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "timers.enable" test/unit/collectors.test.ts` → ≥ 3 matches
- [ ] `grep -rn "describe(\"awaitModal\"" test/unit/collectors.test.ts` → 1 match
- [ ] `test/fixtures/gateway-events.ts` does not exist
- [ ] `node --test ./test/unit/collectors.test.ts` → 0 fail
- [ ] `pnpm test` exits 0, `fail 0`, ≥ 118 tests
- [ ] `pnpm run build:typecheck` and `pnpm run lint` exit 0
- [ ] `git status --porcelain` shows only in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A new test exposes a production bug in `src/collectors/` (e.g. a collector stays registered after timeout) — report it; do not patch `src/`.
- `t.mock.timers` is unavailable or behaves differently (would indicate an unexpected Node version; repo requires >= 24).
- Step 4's grep finds a real consumer of `messageCreateEvent` — skip the deletion and report.
- Converting a test to mock timers makes a _different_ existing test hang (timer mocking leaking across tests — would mean the context-`t` pattern wasn't followed).

## Maintenance notes

- Plan 006 refactors `src/collectors/await-component.ts` / `await-modal.ts` into a shared generic; the tests added here are its regression net — land this plan first.
- Deferred: converting `test/integration/collector-flow.test.ts` off its 200ms sleeps. That requires either mock timers threaded through the bot dispatch path or a flush-based MockGateway helper; worth doing only if integration flake is observed.
- Reviewer focus: every `assert.rejects` on a timed-out promise must be _attached before_ `tick()` — reversing the order intermittently produces unhandled-rejection noise.
