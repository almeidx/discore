# Agent Instructions

## Project

@almeidx/discore — A lightweight, functional Discord bot framework built on `@discordjs/core`.

## Stack

- **Runtime**: Node.js >= 24 (native TypeScript execution via type stripping)
- **Language**: TypeScript (strict mode, ESM-only)
- **Package manager**: pnpm
- **Test runner**: `node:test` (built-in)
- **Peer dependency**: `@discordjs/core` >= 2.0.0

## Architecture

Functional, no classes. The core pattern is `defineX()` functions that return plain definition objects, and `createBot()` that wires everything together.

### Key directories

- `src/types/` — Type definitions (contexts, definitions, hooks, options)
- `src/definitions/` — `defineCommand`, `defineEvent`, `defineButton`, `defineSelectMenu`, `defineModal`, `defineAutocomplete`, `defineCommandGroup`
- `src/context/` — Context factory functions (closure-based state for reply/defer tracking)
- `src/routing/` — Interaction, event, and component routers
- `src/collectors/` — `awaitComponent` and `collectComponents` implementations
- `src/bot.ts` — `createBot` entry point
- `src/publish.ts` — `publishCommands` utility
- `test/unit/` — Unit tests
- `test/integration/` — Integration tests
- `test/fixtures/` — Mock factories for gateway, API, and interaction payloads

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
