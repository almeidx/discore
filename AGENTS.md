# Agent Instructions

## Project

@almeidx/discore — A lightweight, functional Discord bot framework built on `@discordjs/core`.

## Stack

- **Runtime**: Node.js >= 24 (native TypeScript execution via type stripping)
- **Language**: TypeScript (strict mode, ESM-only)
- **Package manager**: pnpm
- **Test runner**: `node:test` (built-in)
- **Peer dependency**: `@discordjs/core` >= 3.0.0-dev

## Architecture

Functional, no classes. The core pattern is `defineX()` functions that return plain definition objects, and `createBot()` that wires everything together.

### Key directories

Code is grouped by feature: each kind's definition type, `defineX`, context type, and context factory live together.

- `src/commands/` — slash commands, command groups, context-menu commands, option parsing/inference, bot-permission check, command router, `publishCommands`
- `src/components/` — buttons, select menus, modals (+ `ModalFields`), shared component context, component router (also hands interactions to collectors first)
- `src/autocomplete/` — autocomplete definition/context and router
- `src/events/` — gateway event definitions, context, and router
- `src/collectors/` — `awaitComponent`, `awaitModal`, `collectComponents`, and the collector stores
- `src/interaction/` — `InteractionContext` with reply/defer state (`acknowledge`), and `runInteraction`: the one pipeline every interaction handler runs through (global before/after interaction hooks, layered before/onError/after hooks, error response)
- `src/hooks.ts` — hook types; `src/bot.ts` — `createBot`, delegating to the routers
- `test/unit/`, `test/integration/` — tests drive a real bot through `test/fixtures/test-bot.ts` (`createTestBot`) and import production code only from `src/index.ts`
- `test/fixtures/` — `createTestBot` (real bot on an `EventEmitter` gateway), mock API spies, interaction payload builders

### Interaction pipeline

Hook layers are ordered outermost (global) to innermost (handler). `before` hooks run outer→inner and cancel on `false`; `onError` hooks run inner→outer and the first `false` suppresses the error; otherwise the fallback response is sent (failure ignored) and the error is rethrown. `after` hooks run inner→outer only if the handler started.

### Type inference

`defineCommand` uses a `const` generic modifier so option arrays are inferred literally. `InferOptions<T>` maps option definitions to typed `ctx.options` properties — required options are non-nullable, optional ones include `| undefined`.

### Component routing

Buttons, select menus, and modals match by regex or exact string on `customId`. Named capture groups become `ctx.params`. First matching handler fires (first-match, not broadcast).

### Collectors

Collectors intercept component interactions before persistent handlers. `awaitComponent` returns a single Promise; `collectComponents` returns an `AsyncIterableIterator` with a buffer for items arriving before iteration starts.

## Commands

```sh
pnpm test          # Run all tests
pnpm build         # Build to dist/
pnpm build:typecheck  # Type-check without emitting
```

## Conventions

- Named exports only (no default exports)
- kebab-case file names
- Imports use `.ts` extensions (rewritten to `.js` on build via `rewriteRelativeImportExtensions`)
- No comments that restate what the code does
- No `any` without justification
- No `@ts-ignore` or `@ts-expect-error` without explanation
