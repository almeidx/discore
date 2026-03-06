import {
	ApplicationCommandOptionType,
	type APIChatInputApplicationCommandInteraction,
	type APIApplicationCommandInteractionDataBasicOption,
} from "discord-api-types/v10";

export function parseOptions(interaction: APIChatInputApplicationCommandInteraction): {
	options: Record<string, unknown>;
	subcommand?: string;
	subcommandGroup?: string;
} {
	const data = interaction.data;
	let rawOptions: APIApplicationCommandInteractionDataBasicOption[] = [];
	let subcommand: string | undefined;
	let subcommandGroup: string | undefined;

	if (data.options) {
		const first = data.options[0];
		if (first && first.type === ApplicationCommandOptionType.SubcommandGroup) {
			subcommandGroup = first.name;
			const sub = first.options?.[0];
			if (sub && sub.type === ApplicationCommandOptionType.Subcommand) {
				subcommand = sub.name;
				rawOptions = (sub.options ?? []) as APIApplicationCommandInteractionDataBasicOption[];
			}
		} else if (first && first.type === ApplicationCommandOptionType.Subcommand) {
			subcommand = first.name;
			rawOptions = (first.options ?? []) as APIApplicationCommandInteractionDataBasicOption[];
		} else {
			rawOptions = data.options as APIApplicationCommandInteractionDataBasicOption[];
		}
	}

	const resolved = data.resolved;
	const options: Record<string, unknown> = {};

	for (const opt of rawOptions) {
		switch (opt.type) {
			case ApplicationCommandOptionType.Attachment: {
				const attachmentId = opt.value as string;
				options[opt.name] = resolved?.attachments?.[attachmentId];
				break;
			}
			case ApplicationCommandOptionType.User: {
				const userId = opt.value as string;
				options[opt.name] = {
					user: resolved?.users?.[userId],
					member: resolved?.members?.[userId],
				};
				break;
			}
			case ApplicationCommandOptionType.Channel: {
				const channelId = opt.value as string;
				options[opt.name] = resolved?.channels?.[channelId];
				break;
			}
			case ApplicationCommandOptionType.Role: {
				const roleId = opt.value as string;
				options[opt.name] = resolved?.roles?.[roleId];
				break;
			}
			case ApplicationCommandOptionType.Mentionable: {
				const id = opt.value as string;
				const user = resolved?.users?.[id];
				if (user) {
					options[opt.name] = { user, member: resolved?.members?.[id] };
				} else {
					options[opt.name] = resolved?.roles?.[id];
				}
				break;
			}
			default:
				options[opt.name] = opt.value;
				break;
		}
	}

	return { options, subcommand, subcommandGroup };
}
