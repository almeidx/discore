import {
	ApplicationCommandOptionType,
	type APIApplicationCommandBasicOption,
	type APIApplicationCommandInteractionDataBasicOption,
	type APIApplicationCommandInteractionDataOption,
	type APIAttachment,
	type APIChatInputApplicationCommandInteractionData,
	type APIInteractionDataResolvedChannel,
	type APIInteractionDataResolvedGuildMember,
	type APIRole,
	type APIUser,
	type InteractionType,
} from "discord-api-types/v10";

export interface ResolvedUser {
	user: APIUser;
	member: APIInteractionDataResolvedGuildMember | undefined;
}

/** Maps each {@link ApplicationCommandOptionType} to its resolved TypeScript type. */
export interface OptionTypeMap {
	[ApplicationCommandOptionType.String]: string;
	[ApplicationCommandOptionType.Integer]: number;
	[ApplicationCommandOptionType.Boolean]: boolean;
	[ApplicationCommandOptionType.User]: ResolvedUser;
	[ApplicationCommandOptionType.Channel]: APIInteractionDataResolvedChannel;
	[ApplicationCommandOptionType.Role]: APIRole;
	[ApplicationCommandOptionType.Mentionable]: ResolvedUser | APIRole;
	[ApplicationCommandOptionType.Number]: number;
	[ApplicationCommandOptionType.Attachment]: APIAttachment;
}

/**
 * Infers a typed options record from a tuple of {@link APIApplicationCommandBasicOption}.
 * Required options are non-nullable; optional ones include `| undefined`.
 */
export type InferOptions<T extends readonly APIApplicationCommandBasicOption[]> = {
	[K in T[number] as K["name"]]: K["required"] extends true
		? OptionTypeMap[K["type"]]
		: OptionTypeMap[K["type"]] | undefined;
};

export interface CommandPath<TType extends InteractionType> {
	subcommandGroup: string | undefined;
	subcommand: string | undefined;
	/** The options of the invoked (sub)command. */
	options: APIApplicationCommandInteractionDataBasicOption<TType>[];
}

export function parseCommandPath<TType extends InteractionType>(
	options: readonly APIApplicationCommandInteractionDataOption<TType>[] | undefined,
): CommandPath<TType> {
	const first = options?.[0];

	if (first?.type === ApplicationCommandOptionType.SubcommandGroup) {
		const sub = first.options?.[0];
		return { subcommandGroup: first.name, subcommand: sub?.name, options: sub?.options ?? [] };
	}

	if (first?.type === ApplicationCommandOptionType.Subcommand) {
		return { subcommandGroup: undefined, subcommand: first.name, options: first.options ?? [] };
	}

	return {
		subcommandGroup: undefined,
		subcommand: undefined,
		options: (options ?? []) as APIApplicationCommandInteractionDataBasicOption<TType>[],
	};
}

export function resolveOptions(
	options: readonly APIApplicationCommandInteractionDataBasicOption<InteractionType.ApplicationCommand>[],
	resolved: APIChatInputApplicationCommandInteractionData["resolved"],
): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	for (const opt of options) {
		switch (opt.type) {
			case ApplicationCommandOptionType.Attachment: {
				const attachment = resolved?.attachments?.[opt.value];
				if (!attachment) throw new Error(`Resolved attachment not found for option "${opt.name}"`);
				result[opt.name] = attachment;
				break;
			}
			case ApplicationCommandOptionType.User: {
				const user = resolved?.users?.[opt.value];
				if (!user) throw new Error(`Resolved user not found for option "${opt.name}"`);
				result[opt.name] = { user, member: resolved?.members?.[opt.value] };
				break;
			}
			case ApplicationCommandOptionType.Channel: {
				const channel = resolved?.channels?.[opt.value];
				if (!channel) throw new Error(`Resolved channel not found for option "${opt.name}"`);
				result[opt.name] = channel;
				break;
			}
			case ApplicationCommandOptionType.Role: {
				const role = resolved?.roles?.[opt.value];
				if (!role) throw new Error(`Resolved role not found for option "${opt.name}"`);
				result[opt.name] = role;
				break;
			}
			case ApplicationCommandOptionType.Mentionable: {
				const user = resolved?.users?.[opt.value];
				if (user) {
					result[opt.name] = { user, member: resolved?.members?.[opt.value] };
				} else {
					const role = resolved?.roles?.[opt.value];
					if (!role) throw new Error(`Resolved mentionable not found for option "${opt.name}"`);
					result[opt.name] = role;
				}
				break;
			}
			default:
				result[opt.name] = opt.value;
				break;
		}
	}

	return result;
}
