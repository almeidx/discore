import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { ApplicationCommandOptionType, type APIUser } from "discord-api-types/v10";
import { defineCommand, defineCommandGroup, type SubcommandGroup } from "../../src/index.ts";
import { subcommandGroupInteraction, subcommandInteraction } from "../fixtures/interactions.ts";
import { createTestBot } from "../fixtures/test-bot.ts";

function createManageBot() {
	const handlers = { kick: mock.fn(() => {}), add: mock.fn(() => {}), remove: mock.fn(() => {}) };
	const roleGroup: SubcommandGroup = {
		name: "role",
		description: "d",
		subcommands: [
			defineCommand({ data: { name: "add", description: "d" }, handler: handlers.add }),
			defineCommand({ data: { name: "remove", description: "d" }, handler: handlers.remove }),
		],
	};
	const group = defineCommandGroup({
		data: { name: "manage", description: "d" },
		subcommands: [defineCommand({ data: { name: "kick", description: "d" }, handler: handlers.kick }), roleGroup],
	});
	const callCounts = () => ({
		kick: handlers.kick.mock.callCount(),
		add: handlers.add.mock.callCount(),
		remove: handlers.remove.mock.callCount(),
	});
	return { ...createTestBot({ commands: [group] }), callCounts };
}

describe("command group flow", () => {
	it("routes a subcommand inside a subcommand group", async () => {
		const { interact, callCounts } = createManageBot();

		await interact(subcommandGroupInteraction("manage", "role", "add"));

		assert.deepStrictEqual(callCounts(), { kick: 0, add: 1, remove: 0 });
	});

	it("routes to the second subcommand of a subcommand group", async () => {
		const { interact, callCounts } = createManageBot();

		await interact(subcommandGroupInteraction("manage", "role", "remove"));

		assert.deepStrictEqual(callCounts(), { kick: 0, add: 0, remove: 1 });
	});

	it("routes a top-level subcommand of a group", async () => {
		const { interact, callCounts } = createManageBot();

		await interact(subcommandInteraction("manage", "kick"));

		assert.deepStrictEqual(callCounts(), { kick: 1, add: 0, remove: 0 });
	});

	it("does not route a top-level subcommand name to a subcommand nested in a group", async () => {
		const { interact, callCounts } = createManageBot();

		await interact(subcommandInteraction("manage", "add"));

		assert.deepStrictEqual(callCounts(), { kick: 0, add: 0, remove: 0 });
	});

	it("resolves the invoked subcommand's options", async () => {
		const user = { id: "999", username: "test", discriminator: "0", avatar: null, global_name: null } satisfies APIUser;
		let received: unknown;
		const ban = defineCommand({
			data: {
				name: "ban",
				description: "d",
				options: [{ name: "user", type: ApplicationCommandOptionType.User, description: "d", required: true }],
			},
			handler: (ctx) => {
				received = ctx.options;
			},
		});
		const { interact } = createTestBot({
			commands: [defineCommandGroup({ data: { name: "mod", description: "d" }, subcommands: [ban] })],
		});
		const interaction = subcommandInteraction("mod", "ban", [
			{ name: "user", type: ApplicationCommandOptionType.User, value: user.id },
		]);
		interaction.data.resolved = { users: { [user.id]: user } };

		await interact(interaction);

		assert.deepStrictEqual(received, { user: { user, member: undefined } });
	});
});
