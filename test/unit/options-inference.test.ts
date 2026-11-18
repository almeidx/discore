// Compile-time checks of `ctx.options` inference; CI typechecks test/. Nothing here runs a handler.
import {
	ApplicationCommandOptionType,
	type APIAttachment,
	type APIInteractionDataResolvedChannel,
	type APIRole,
} from "discord-api-types/v10";
import { defineCommand, type ResolvedUser } from "../../src/index.ts";

/** `true` only when A and B are identical; unlike assignability, `any` does not satisfy it. */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

defineCommand({
	data: {
		name: "required",
		description: "d",
		options: [
			{ name: "text", type: ApplicationCommandOptionType.String, description: "d", required: true },
			{ name: "count", type: ApplicationCommandOptionType.Integer, description: "d", required: true },
			{ name: "ratio", type: ApplicationCommandOptionType.Number, description: "d", required: true },
			{ name: "flag", type: ApplicationCommandOptionType.Boolean, description: "d", required: true },
			{ name: "user", type: ApplicationCommandOptionType.User, description: "d", required: true },
			{ name: "channel", type: ApplicationCommandOptionType.Channel, description: "d", required: true },
			{ name: "role", type: ApplicationCommandOptionType.Role, description: "d", required: true },
			{ name: "target", type: ApplicationCommandOptionType.Mentionable, description: "d", required: true },
			{ name: "file", type: ApplicationCommandOptionType.Attachment, description: "d", required: true },
		],
	},
	handler: (ctx) => {
		const inferred: Equal<
			typeof ctx.options,
			{
				text: string;
				count: number;
				ratio: number;
				flag: boolean;
				user: ResolvedUser;
				channel: APIInteractionDataResolvedChannel;
				role: APIRole;
				target: ResolvedUser | APIRole;
				file: APIAttachment;
			}
		> = true;
		void inferred;
	},
});

defineCommand({
	data: {
		name: "optional",
		description: "d",
		options: [
			{ name: "reason", type: ApplicationCommandOptionType.String, description: "d", required: false },
			{ name: "days", type: ApplicationCommandOptionType.Integer, description: "d" },
			{ name: "user", type: ApplicationCommandOptionType.User, description: "d", required: true },
		],
	},
	handler: (ctx) => {
		const inferred: Equal<
			typeof ctx.options,
			{ reason: string | undefined; days: number | undefined; user: ResolvedUser }
		> = true;
		void inferred;
		// @ts-expect-error -- options not declared on the command are not on ctx.options
		void ctx.options.missing;
	},
});

defineCommand({
	data: { name: "none", description: "d" },
	handler: (ctx) => {
		const inferred: Equal<typeof ctx.options, {}> = true;
		void inferred;
	},
});
