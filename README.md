# @almeidx/discore

A lightweight, functional Discord bot framework built on [`@discordjs/core`](https://github.com/discordjs/discord.js/tree/main/packages/core).

## Features

- **Functional API** — No classes, just functions. `defineCommand`, `defineEvent`, `defineButton`, etc.
- **Type-safe options** — Command options inferred from definitions. `ctx.options.user` is typed automatically.
- **Component routing** — Regex-based `customId` matching with named capture groups as `ctx.params`.
- **Collectors** — `awaitComponent` (single, Promise-based) and `collectComponents` (async iterator).
- **Hooks** — Per-command and global `beforeCommand`/`afterCommand`/`onError` hooks.
- **Command publishing** — `publishCommands` maps definitions to the Discord API format.

## Requirements

- Node.js >= 24.0.0
- `@discordjs/core` >= 2.0.0

## Install

```sh
npm install @almeidx/discore @discordjs/core @discordjs/rest @discordjs/ws
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

createBot({ rest, gateway, commands: [ping] });
await publishCommands({ token, commands: [ping] });
await gateway.connect();
```

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
		// ctx.options.user: string (required — always present)
		// ctx.options.reason: string | undefined (optional)
		await ctx.reply({ content: `Banned <@${ctx.options.user}>` });
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

## More examples

See the [`examples/`](./examples) directory.

## License

ISC
