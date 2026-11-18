import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
	ApplicationCommandOptionType,
	GuildMemberFlags,
	type APIApplicationCommandBasicOption,
	type APIAttachment,
	type APIInteractionDataResolved,
	type APIInteractionDataResolvedChannel,
	type APIInteractionDataResolvedGuildMember,
	type APIRole,
	type APIUser,
} from "discord-api-types/v10";
import { defineCommand } from "../../src/index.ts";
import { chatInputInteraction } from "../fixtures/interactions.ts";
import { createTestBot } from "../fixtures/test-bot.ts";

const user = { id: "10", username: "target", discriminator: "0", avatar: null, global_name: null } satisfies APIUser;
const member: APIInteractionDataResolvedGuildMember = {
	roles: [],
	joined_at: "2024-01-01T00:00:00.000Z",
	flags: GuildMemberFlags.CompletedOnboarding,
	permissions: "0",
};
const role = { id: "20", name: "Moderators" } as APIRole;
const channel = { id: "30", name: "general", type: 0, permissions: "0" } as APIInteractionDataResolvedChannel;
const attachment = { id: "40", filename: "a.png", size: 1, url: "u", proxy_url: "p" } satisfies APIAttachment;

function option(name: string, type: APIApplicationCommandBasicOption["type"]): APIApplicationCommandBasicOption {
	return { name, type, description: "d" } as APIApplicationCommandBasicOption;
}

/** Invokes a command declaring `declared` with the given raw options and resolved data; returns `ctx.options`. */
async function resolveOptions(
	declared: APIApplicationCommandBasicOption[],
	raw: { name: string; type: ApplicationCommandOptionType; value: unknown }[],
	resolved: APIInteractionDataResolved = {},
): Promise<unknown> {
	let options: unknown;
	const command = defineCommand({
		data: { name: "opts", description: "d", options: declared },
		handler: (ctx) => {
			options = ctx.options;
		},
	});
	const { interact } = createTestBot({ commands: [command] });
	const interaction = chatInputInteraction("opts", raw);
	interaction.data.resolved = resolved;
	await interact(interaction);
	return options;
}

describe("command options", () => {
	it("passes primitive option values through by name", async () => {
		const options = await resolveOptions(
			[
				option("text", ApplicationCommandOptionType.String),
				option("count", ApplicationCommandOptionType.Integer),
				option("ratio", ApplicationCommandOptionType.Number),
				option("flag", ApplicationCommandOptionType.Boolean),
			],
			[
				{ name: "text", type: ApplicationCommandOptionType.String, value: "hello" },
				{ name: "count", type: ApplicationCommandOptionType.Integer, value: 42 },
				{ name: "ratio", type: ApplicationCommandOptionType.Number, value: 1.5 },
				{ name: "flag", type: ApplicationCommandOptionType.Boolean, value: false },
			],
		);

		assert.deepStrictEqual(options, { text: "hello", count: 42, ratio: 1.5, flag: false });
	});

	it("leaves omitted options out of ctx.options", async () => {
		const options = await resolveOptions([option("text", ApplicationCommandOptionType.String)], []);

		assert.deepStrictEqual(options, {});
	});

	it("resolves user options to the user and, when present, the guild member", async () => {
		const other = { ...user, id: "11" };
		const options = await resolveOptions(
			[option("withMember", ApplicationCommandOptionType.User), option("plain", ApplicationCommandOptionType.User)],
			[
				{ name: "withMember", type: ApplicationCommandOptionType.User, value: user.id },
				{ name: "plain", type: ApplicationCommandOptionType.User, value: other.id },
			],
			{ users: { [user.id]: user, [other.id]: other }, members: { [user.id]: member } },
		);

		assert.deepStrictEqual(options, {
			withMember: { user, member },
			plain: { user: other, member: undefined },
		});
	});

	it("resolves channel, role and attachment options from resolved data", async () => {
		const options = await resolveOptions(
			[
				option("channel", ApplicationCommandOptionType.Channel),
				option("role", ApplicationCommandOptionType.Role),
				option("file", ApplicationCommandOptionType.Attachment),
			],
			[
				{ name: "channel", type: ApplicationCommandOptionType.Channel, value: channel.id },
				{ name: "role", type: ApplicationCommandOptionType.Role, value: role.id },
				{ name: "file", type: ApplicationCommandOptionType.Attachment, value: attachment.id },
			],
			{
				channels: { [channel.id]: channel },
				roles: { [role.id]: role },
				attachments: { [attachment.id]: attachment },
			},
		);

		assert.deepStrictEqual(options, { channel, role, file: attachment });
	});

	it("resolves mentionable options to a user when one matches, otherwise to a role", async () => {
		const options = await resolveOptions(
			[
				option("who", ApplicationCommandOptionType.Mentionable),
				option("group", ApplicationCommandOptionType.Mentionable),
			],
			[
				{ name: "who", type: ApplicationCommandOptionType.Mentionable, value: user.id },
				{ name: "group", type: ApplicationCommandOptionType.Mentionable, value: role.id },
			],
			{ users: { [user.id]: user }, members: { [user.id]: member }, roles: { [role.id]: role } },
		);

		assert.deepStrictEqual(options, { who: { user, member }, group: role });
	});

	for (const [type, label] of [
		[ApplicationCommandOptionType.User, "user"],
		[ApplicationCommandOptionType.Channel, "channel"],
		[ApplicationCommandOptionType.Role, "role"],
		[ApplicationCommandOptionType.Attachment, "attachment"],
		[ApplicationCommandOptionType.Mentionable, "mentionable"],
	] as const) {
		it(`rejects without running the handler when the resolved ${label} is missing`, async () => {
			const handler = mock.fn(() => {});
			const command = defineCommand({
				data: { name: "opts", description: "d", options: [option("target", type)] },
				handler,
			});
			const { interact } = createTestBot({ commands: [command] });

			await assert.rejects(interact(chatInputInteraction("opts", [{ name: "target", type, value: "999" }])), {
				message: `Resolved ${label} not found for option "target"`,
			});
			assert.strictEqual(handler.mock.callCount(), 0);
		});
	}
});
