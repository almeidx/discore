# @almeidx/discore

A lightweight, functional Discord bot framework built on [`@discordjs/core`](https://github.com/discordjs/discord.js/tree/main/packages/core).

## Features

- **Functional API** — No classes, just functions. `defineCommand`, `defineEvent`, `defineButton`, etc.
- **Type-safe options** — Command options inferred from definitions. `ctx.options.user` is typed automatically.
- **Component routing** — Regex-based `customId` matching with named capture groups as `ctx.params`.
- **Collectors** — `awaitComponent` and `awaitModal` (single, Promise-based) and `collectComponents` (async iterator).
- **Hooks** — Per-command and global `beforeCommand`/`afterCommand`/`onError` hooks; per-definition `onError` on components, events, and autocomplete.
- **Command publishing** — `publishCommands` maps definitions to the Discord API format.

## Requirements

- Node.js >= 22.19.0
- `@discordjs/core` >= 3.0.0-dev

## Install

```sh
npm install @almeidx/discore @discordjs/collection @discordjs/core @discordjs/rest @discordjs/ws discord-api-types
```

## Quick start

```ts
import { REST } from "@discordjs/rest";
import { WebSocketManager } from "@discordjs/ws";
import { GatewayIntentBits, Routes, type RESTGetAPIGatewayBotResult } from "discord-api-types/v10";
import { createBot, defineCommand, publishCommands } from "@almeidx/discore";

const token = process.env.DISCORD_TOKEN!;

const ping = defineCommand({
	data: {
		name: "ping",
		description: "Pong!",
	},
	handler: async (ctx) => {
		await ctx.reply({ content: "Pong!" });
	},
});

const rest = new REST().setToken(token);
const gateway = new WebSocketManager({
	token,
	intents: GatewayIntentBits.Guilds,
	fetchGatewayInformation: () => rest.get(Routes.gatewayBot()) as Promise<RESTGetAPIGatewayBotResult>,
});

const bot = createBot({ rest, gateway, commands: [ping] });
await publishCommands({ api: bot.api, applicationId: process.env.DISCORD_APP_ID!, commands: [ping] });
await gateway.connect();
```

## Interaction callback responses

Pass `with_response: true` to `defer` when the handler needs Discord's interaction callback response. The
returned resource can include the message created by the acknowledgement.

```ts
const response = await ctx.defer({ with_response: true });
const message = response.resource?.message;
```

Without `with_response: true`, `defer` resolves to `undefined`.

## Mixed command publishing

`commandToPayload` converts a Discore definition without publishing it. Use it when an application needs to
combine Discore commands with commands managed by another framework in one bulk overwrite.
Subcommand localization metadata is not yet preserved for command groups; see [Planned improvements](#planned-improvements).

```ts
import { commandToPayload } from "@almeidx/discore";

const body = [...legacyCommandPayloads, ...discoreCommands.map(commandToPayload)];
await bot.api.applicationCommands.bulkOverwriteGlobalCommands(applicationId, body);
```

## Error handling

Handler errors are surfaced by default. Discore sends the configured error response, or empty autocomplete choices for autocomplete handlers, then rethrows the original error. Return `false` from an `onError` hook only when the hook has handled the error and should suppress both the fallback response and the rethrow.

The rethrown error rejects the gateway dispatch listener. By default that becomes an unhandled promise rejection, which terminates a Node.js process -- register an `onError` hook that returns `false`, a `process.on("unhandledRejection")` handler, or enable `captureRejections` on the `WebSocketManager` and listen to its `error` event if you want the bot to keep running. An error thrown by one handler no longer prevents other handlers (such as `defineEvent` handlers for the same gateway payload) from running; when several handlers fail on one payload, the rejection is an `AggregateError`.

## Typed options

```ts
import { ApplicationCommandOptionType } from "discord-api-types/v10";
import { defineCommand } from "@almeidx/discore";

const ban = defineCommand({
	data: {
		name: "ban",
		description: "Ban a member",
		options: [
			{ name: "user", type: ApplicationCommandOptionType.User, description: "Target user", required: true },
			{ name: "reason", type: ApplicationCommandOptionType.String, description: "Ban reason" },
		],
	},
	handler: async (ctx) => {
		// ctx.options.user: { user, member } (required — always present)
		// ctx.options.reason: string | undefined (optional)
		await ctx.reply({ content: `Banned <@${ctx.options.user.user.id}>` });
	},
});
```

## Components

Buttons, select menus, and modals use regex patterns with named capture groups:

```ts
import { MessageFlags } from "discord-api-types/v10";
import { defineButton } from "@almeidx/discore";

const verify = defineButton({
	customId: /^verify:(?<userId>\d+)$/,
	handler: async (ctx) => {
		const userId = ctx.params.userId; // extracted from the regex match
		await ctx.reply({ content: `Verified ${userId}!`, flags: MessageFlags.Ephemeral });
	},
});
```

## Collectors

```ts
const response = await ctx.awaitComponent({
	filter: (i) => i.customId === "confirm",
	timeout: 30_000,
});

// Or iterate over multiple interactions:
const collector = ctx.collectComponents({
	filter: (i) => i.customId.startsWith("vote:"),
	timeout: 60_000,
});

for await (const interaction of collector) {
	await interaction.reply({ content: "Recorded!", flags: MessageFlags.Ephemeral });
}
```

Modals are collected the same way -- show the modal, then await its submission:

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

`awaitComponent`, `awaitModal`, and `collectComponents` reject (or end) with a `CollectorTimeoutError` when the timeout elapses -- wrap them in `try/catch` if a timeout is an expected outcome (see `examples/config-command.ts`).

## Planned improvements

- Support externally managed gateway dispatch.
- Allow applications to inject typed services into handler contexts or access the owning bot.
- Configure bot-level response defaults such as allowed mentions.
- Return callback responses from the remaining initial acknowledgement helpers.
- Preserve localization metadata throughout command groups and nested subcommand groups.

## More examples

See the [`examples/`](./examples) directory.

## Development

```sh
pnpm install
pnpm test              # node:test suite
pnpm run lint          # oxfmt --check && oxlint
pnpm run build:typecheck
pnpm build             # tsdown -> dist/
```

## License

[Apache-2.0](./LICENSE)
