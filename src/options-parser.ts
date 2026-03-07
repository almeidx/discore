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
				rawOptions = sub.options ?? [];
			}
		} else if (first && first.type === ApplicationCommandOptionType.Subcommand) {
			subcommand = first.name;
			rawOptions = first.options ?? [];
		} else {
			rawOptions = data.options as APIApplicationCommandInteractionDataBasicOption[];
		}
	}

	const resolved = data.resolved;
	const options: Record<string, unknown> = {};

	for (const opt of rawOptions) {
		switch (opt.type) {
			case ApplicationCommandOptionType.Attachment: {
				options[opt.name] = resolved?.attachments?.[opt.value];
				break;
			}
			case ApplicationCommandOptionType.User: {
				options[opt.name] = {
					user: resolved?.users?.[opt.value],
					member: resolved?.members?.[opt.value],
				};
				break;
			}
			case ApplicationCommandOptionType.Channel: {
				options[opt.name] = resolved?.channels?.[opt.value];
				break;
			}
			case ApplicationCommandOptionType.Role: {
				options[opt.name] = resolved?.roles?.[opt.value];
				break;
			}
			case ApplicationCommandOptionType.Mentionable: {
				const user = resolved?.users?.[opt.value];
				if (user) {
					options[opt.name] = { user, member: resolved?.members?.[opt.value] };
				} else {
					options[opt.name] = resolved?.roles?.[opt.value];
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
