import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
	defineCommand,
	defineCommandGroup,
	type AnyCommandContext,
	type CommandHooks,
	type GlobalHooks,
} from "../../src/index.ts";
import { chatInputInteraction, subcommandInteraction } from "../fixtures/interactions.ts";
import { createTestBot, type TestBotOptions } from "../fixtures/test-bot.ts";

const BAN_MEMBERS = 4n;
const KICK_MEMBERS = 2n;

function banCommand(botOptions: TestBotOptions = {}) {
	const handler = mock.fn(async () => {});
	const command = defineCommand({
		data: { name: "ban", description: "d" },
		requiredBotPermissions: BAN_MEMBERS,
		handler,
	});
	return { handler, ...createTestBot({ ...botOptions, commands: [command] }) };
}

function invocation(appPermissions: string | undefined) {
	const interaction = chatInputInteraction("ban");
	if (appPermissions === undefined) Reflect.deleteProperty(interaction, "app_permissions");
	else interaction.app_permissions = appPermissions;
	return interaction;
}

describe("requiredBotPermissions", () => {
	it("blocks the command without responding when permissions are missing", async () => {
		const { handler, api, interact } = banCommand();

		await interact(invocation("0"));

		assert.strictEqual(handler.mock.callCount(), 0);
		assert.strictEqual(api.interactions.reply.mock.callCount(), 0);
	});

	it("runs the command when the bot has the permissions", async () => {
		const { handler, interact } = banCommand();

		await interact(invocation(String(BAN_MEMBERS | KICK_MEMBERS)));

		assert.strictEqual(handler.mock.callCount(), 1);
	});

	it("skips the check when the interaction carries no app_permissions", async () => {
		const { handler, interact } = banCommand();

		await interact(invocation(undefined));

		assert.strictEqual(handler.mock.callCount(), 1);
	});

	it("reports only the missing bits to onMissingBotPermissions", async () => {
		const onMissingBotPermissions = mock.fn((_ctx: AnyCommandContext, _missing: bigint) => {});
		const command = defineCommand({
			data: { name: "mod", description: "d" },
			requiredBotPermissions: BAN_MEMBERS | KICK_MEMBERS,
			hooks: { onMissingBotPermissions },
			handler: () => {},
		});
		const { interact } = createTestBot({ commands: [command] });
		const interaction = chatInputInteraction("mod");
		interaction.app_permissions = String(BAN_MEMBERS);

		await interact(interaction);

		assert.strictEqual(onMissingBotPermissions.mock.calls[0]?.arguments[1], KICK_MEMBERS);
	});

	describe("in a command group", () => {
		function groupedBot(hooks: { global?: GlobalHooks; group?: CommandHooks; command?: CommandHooks } = {}) {
			const handler = mock.fn(async () => {});
			const kick = defineCommand({
				data: { name: "kick", description: "d" },
				requiredBotPermissions: KICK_MEMBERS,
				hooks: hooks.command,
				handler,
			});
			const group = defineCommandGroup({
				data: { name: "mod", description: "d" },
				requiredBotPermissions: BAN_MEMBERS,
				hooks: hooks.group,
				subcommands: [kick],
			});
			const testBot = createTestBot({
				commands: [group],
				hooks: hooks.global,
				missingPermissionsResponse: { content: "Missing permissions" },
			});
			const invoke = (appPermissions: bigint) => {
				const interaction = subcommandInteraction("mod", "kick");
				interaction.app_permissions = String(appPermissions);
				return testBot.interact(interaction);
			};
			return { ...testBot, handler, invoke };
		}

		it("requires both the group's and the subcommand's permissions", async () => {
			const { handler, invoke } = groupedBot();

			await invoke(KICK_MEMBERS);
			await invoke(BAN_MEMBERS);
			assert.strictEqual(handler.mock.callCount(), 0);

			await invoke(BAN_MEMBERS | KICK_MEMBERS);
			assert.strictEqual(handler.mock.callCount(), 1);
		});

		it("runs every onMissingBotPermissions hook global → group → command instead of the configured response", async () => {
			const calls: [string, AnyCommandContext, bigint][] = [];
			const recording = (layer: string): Pick<CommandHooks, "onMissingBotPermissions"> => ({
				onMissingBotPermissions: (ctx, missing) => void calls.push([layer, ctx, missing]),
			});
			const { handler, api, invoke } = groupedBot({
				global: recording("global"),
				group: recording("group"),
				command: recording("command"),
			});

			await invoke(KICK_MEMBERS);

			assert.deepStrictEqual(
				calls.map(([layer, , missing]) => [layer, missing]),
				[
					["global", BAN_MEMBERS],
					["group", BAN_MEMBERS],
					["command", BAN_MEMBERS],
				],
			);
			assert.strictEqual(calls[0]?.[1].interaction.data.name, "mod");
			assert.ok(calls.every(([, ctx]) => ctx === calls[0]?.[1]));
			assert.strictEqual(handler.mock.callCount(), 0);
			assert.strictEqual(api.interactions.reply.mock.callCount(), 0);
		});

		for (const bypassing of ["global", "group", "command"] as const) {
			it(`runs the command when the ${bypassing} onMissingBotPermissions hook returns true`, async () => {
				const hookCalls: string[] = [];
				const layer = (name: "global" | "group" | "command"): Pick<CommandHooks, "onMissingBotPermissions"> => ({
					onMissingBotPermissions: () => {
						hookCalls.push(name);
						return name === bypassing;
					},
				});
				const { handler, invoke } = groupedBot({
					global: layer("global"),
					group: layer("group"),
					command: layer("command"),
				});

				await invoke(0n);

				assert.deepStrictEqual(hookCalls, ["global", "group", "command"]);
				assert.strictEqual(handler.mock.callCount(), 1);
			});
		}
	});

	describe("missingPermissionsResponse", () => {
		it("replies with a configured response object", async () => {
			const response = { content: "I need Ban Members.", flags: 64 };
			const { handler, api, interact } = banCommand({ missingPermissionsResponse: response });
			const interaction = invocation("0");

			await interact(interaction);

			assert.strictEqual(handler.mock.callCount(), 0);
			assert.deepStrictEqual(
				api.interactions.reply.mock.calls.map((call) => call.arguments),
				[[interaction.id, interaction.token, response]],
			);
		});

		it("replies with the result of a response function given the context and missing bits", async () => {
			const missingPermissionsResponse = mock.fn((ctx: AnyCommandContext, missing: bigint) => ({
				content: `${ctx.interaction.data.name} needs ${missing}`,
			}));
			const { handler, api, interact } = banCommand({ missingPermissionsResponse });
			const interaction = invocation("0");

			await interact(interaction);

			assert.strictEqual(handler.mock.callCount(), 0);
			assert.strictEqual(missingPermissionsResponse.mock.callCount(), 1);
			assert.deepStrictEqual(
				api.interactions.reply.mock.calls.map((call) => call.arguments),
				[[interaction.id, interaction.token, { content: "ban needs 4" }]],
			);
		});

		it("sends nothing when set to null", async () => {
			const { handler, api, interact } = banCommand({ missingPermissionsResponse: null });

			await interact(invocation("0"));

			assert.strictEqual(handler.mock.callCount(), 0);
			assert.strictEqual(api.interactions.reply.mock.callCount(), 0);
		});
	});
});
