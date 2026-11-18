import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { WebSocketShardEvents } from "@discordjs/ws";
import { ApplicationCommandOptionType, GatewayDispatchEvents } from "discord-api-types/v10";
import {
	defineAutocomplete,
	defineButton,
	defineCommand,
	defineEvent,
	defineMessageCommand,
	defineUserCommand,
} from "../../src/index.ts";
import {
	autocompleteInteraction,
	buttonInteraction,
	chatInputInteraction,
	messageCommandInteraction,
	userCommandInteraction,
} from "../fixtures/interactions.ts";
import { createTestBot } from "../fixtures/test-bot.ts";

describe("bot lifecycle", () => {
	it("reports ping as the average of each shard's latest heartbeat latency", () => {
		const { bot, gateway } = createTestBot();

		assert.strictEqual(bot.ping, undefined);

		gateway.emit(WebSocketShardEvents.HeartbeatComplete, { latency: 100 }, 0);
		assert.strictEqual(bot.ping, 100);

		gateway.emit(WebSocketShardEvents.HeartbeatComplete, { latency: 50 }, 1);
		assert.strictEqual(bot.ping, 75);

		gateway.emit(WebSocketShardEvents.HeartbeatComplete, { latency: 20 }, 0);
		assert.strictEqual(bot.ping, 35);
	});

	it("routes commands added after creation and stops routing removed ones", async () => {
		const chatHandler = mock.fn();
		const userHandler = mock.fn();
		const messageHandler = mock.fn();
		const ping = defineCommand({ data: { name: "ping", description: "Ping" }, handler: chatHandler });
		const inspectUser = defineUserCommand({ data: { name: "Inspect User" }, handler: userHandler });
		const inspectMessage = defineMessageCommand({ data: { name: "Inspect Message" }, handler: messageHandler });
		const { bot, interact } = createTestBot();

		bot.addCommand(ping);
		bot.addCommand(inspectUser);
		bot.addCommand(inspectMessage);

		assert.strictEqual(bot.commands.get("ping"), ping);
		assert.strictEqual(bot.userCommands.get("Inspect User"), inspectUser);
		assert.strictEqual(bot.messageCommands.get("Inspect Message"), inspectMessage);

		await interact(chatInputInteraction("ping"));
		await interact(userCommandInteraction("Inspect User", "777777777777777777"));
		await interact(messageCommandInteraction("Inspect Message", "888888888888888888"));

		assert.strictEqual(bot.removeCommand("ping"), true);
		assert.strictEqual(bot.removeCommand("Inspect User"), true);
		assert.strictEqual(bot.removeCommand("Inspect Message"), true);
		assert.strictEqual(bot.removeCommand("ping"), false);
		assert.strictEqual(bot.commands.has("ping"), false);
		assert.strictEqual(bot.userCommands.size, 0);
		assert.strictEqual(bot.messageCommands.size, 0);

		await interact(chatInputInteraction("ping"));
		await interact(userCommandInteraction("Inspect User", "777777777777777777"));
		await interact(messageCommandInteraction("Inspect Message", "888888888888888888"));

		assert.strictEqual(chatHandler.mock.callCount(), 1);
		assert.strictEqual(userHandler.mock.callCount(), 1);
		assert.strictEqual(messageHandler.mock.callCount(), 1);
	});

	it("dispatches to events added after creation and stops after removal", async () => {
		const handler = mock.fn();
		const event = defineEvent({ event: GatewayDispatchEvents.MessageCreate, handler });
		const { bot, dispatch } = createTestBot();

		bot.addEvent(event);
		await dispatch(GatewayDispatchEvents.MessageCreate, {});

		assert.strictEqual(bot.removeEvent(event), true);
		assert.strictEqual(bot.removeEvent(event), false);
		await dispatch(GatewayDispatchEvents.MessageCreate, {});

		assert.strictEqual(handler.mock.callCount(), 1);
	});

	it("routes interactions added after creation and stops after removal", async () => {
		const buttonHandler = mock.fn();
		const autocompleteHandler = mock.fn();
		const button = defineButton({ customId: "confirm", handler: buttonHandler });
		const autocomplete = defineAutocomplete({ command: "search", option: "query", handler: autocompleteHandler });
		const search = autocompleteInteraction("search", {
			name: "query",
			value: "abc",
			type: ApplicationCommandOptionType.String,
		});
		const { bot, interact } = createTestBot();

		bot.addInteraction(button);
		bot.addInteraction(autocomplete);
		await interact(buttonInteraction("confirm"));
		await interact(search);

		assert.strictEqual(bot.removeInteraction(button), true);
		assert.strictEqual(bot.removeInteraction(autocomplete), true);
		assert.strictEqual(bot.removeInteraction(button), false);
		assert.strictEqual(bot.removeInteraction(autocomplete), false);
		await interact(buttonInteraction("confirm"));
		await interact(search);

		assert.strictEqual(buttonHandler.mock.callCount(), 1);
		assert.strictEqual(autocompleteHandler.mock.callCount(), 1);
	});

	it("destroy detaches the dispatch and heartbeat listeners", async () => {
		const handler = mock.fn();
		const { bot, gateway, dispatch } = createTestBot({
			events: [defineEvent({ event: GatewayDispatchEvents.MessageCreate, handler })],
		});
		bot.destroy();
		gateway.emit(WebSocketShardEvents.HeartbeatComplete, { latency: 100 }, 0);
		await dispatch(GatewayDispatchEvents.MessageCreate, {});

		assert.strictEqual(bot.ping, undefined);
		assert.strictEqual(handler.mock.callCount(), 0);
	});
});
