import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import type { APIInteractionDataResolvedGuildMember } from "discord-api-types/v10";
import {
	defineMessageCommand,
	defineUserCommand,
	type MessageCommandContext,
	type UserCommandContext,
} from "../../src/index.ts";
import { messageCommandInteraction, userCommandInteraction } from "../fixtures/interactions.ts";
import { createTestBot } from "../fixtures/test-bot.ts";

const TARGET_USER = "777777777777777777";
const TARGET_MESSAGE = "888888888888888888";

describe("context menu command flow", () => {
	it("gives user commands the target user", async () => {
		let received: UserCommandContext | undefined;
		const { interact } = createTestBot({
			commands: [
				defineUserCommand({
					data: { name: "User Info" },
					handler: (ctx) => {
						received = ctx;
					},
				}),
			],
		});
		const interaction = userCommandInteraction("User Info", TARGET_USER);

		await interact(interaction);

		assert.ok(received);
		assert.strictEqual(received.interaction, interaction);
		assert.strictEqual(received.targetUser.id, TARGET_USER);
		assert.strictEqual(received.targetUser.username, "targetuser");
		assert.strictEqual(received.targetMember, undefined);
	});

	it("gives user commands the target member when the user was resolved as a guild member", async () => {
		let targetMember: APIInteractionDataResolvedGuildMember | undefined;
		const { interact } = createTestBot({
			commands: [
				defineUserCommand({
					data: { name: "User Info" },
					handler: (ctx) => {
						targetMember = ctx.targetMember;
					},
				}),
			],
		});
		const interaction = userCommandInteraction("User Info", TARGET_USER);
		const member = { nick: "Target", roles: [] } as unknown as APIInteractionDataResolvedGuildMember;
		interaction.data.resolved.members = { [TARGET_USER]: member };

		await interact(interaction);

		assert.strictEqual(targetMember, member);
	});

	it("gives message commands the target message", async () => {
		let received: MessageCommandContext | undefined;
		const { interact } = createTestBot({
			commands: [
				defineMessageCommand({
					data: { name: "Bookmark" },
					handler: (ctx) => {
						received = ctx;
					},
				}),
			],
		});

		await interact(messageCommandInteraction("Bookmark", TARGET_MESSAGE));

		assert.ok(received);
		assert.strictEqual(received.targetMessage.id, TARGET_MESSAGE);
		assert.strictEqual(received.targetMessage.content, "Hello world");
	});

	it("routes by command type as well as name", async () => {
		const userHandler = mock.fn();
		const messageHandler = mock.fn();
		const { api, interact } = createTestBot({
			commands: [
				defineUserCommand({ data: { name: "Inspect" }, handler: userHandler }),
				defineMessageCommand({ data: { name: "Inspect" }, handler: messageHandler }),
			],
		});

		await interact(userCommandInteraction("Inspect", TARGET_USER));
		await interact(userCommandInteraction("Unknown", TARGET_USER));

		assert.strictEqual(userHandler.mock.callCount(), 1);
		assert.strictEqual(messageHandler.mock.callCount(), 0);

		await interact(messageCommandInteraction("Inspect", TARGET_MESSAGE));

		assert.strictEqual(userHandler.mock.callCount(), 1);
		assert.strictEqual(messageHandler.mock.callCount(), 1);
		assert.strictEqual(api.interactions.reply.mock.callCount(), 0);
	});

	it("runs interaction, global, and command hooks around user commands", async () => {
		const order: string[] = [];
		const { interact } = createTestBot({
			hooks: {
				beforeInteraction: () => {
					order.push("beforeInteraction");
				},
				beforeCommand: () => {
					order.push("global before");
				},
				afterCommand: () => {
					order.push("global after");
				},
				afterInteraction: () => {
					order.push("afterInteraction");
				},
			},
			commands: [
				defineUserCommand({
					data: { name: "User Info" },
					hooks: {
						beforeCommand: () => {
							order.push("command before");
						},
						afterCommand: () => {
							order.push("command after");
						},
					},
					handler: () => {
						order.push("handler");
					},
				}),
			],
		});

		await interact(userCommandInteraction("User Info", TARGET_USER));

		assert.deepStrictEqual(order, [
			"beforeInteraction",
			"global before",
			"command before",
			"handler",
			"command after",
			"global after",
			"afterInteraction",
		]);
	});

	it("blocks a user command missing bot permissions and reports only the missing bits", async () => {
		const handler = mock.fn();
		const missingSeen: bigint[] = [];
		const { interact } = createTestBot({
			commands: [
				defineUserCommand({
					data: { name: "User Info" },
					requiredBotPermissions: 4n | 8n,
					hooks: {
						onMissingBotPermissions: (_ctx, missing) => {
							missingSeen.push(missing);
						},
					},
					handler,
				}),
			],
		});
		const interaction = userCommandInteraction("User Info", TARGET_USER);
		interaction.app_permissions = "4";

		await interact(interaction);

		assert.strictEqual(handler.mock.callCount(), 0);
		assert.deepStrictEqual(missingSeen, [8n]);
	});
});
