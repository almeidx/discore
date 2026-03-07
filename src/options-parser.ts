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
				const attachment = resolved?.attachments?.[opt.value];
				if (!attachment) throw new Error(`Resolved attachment not found for option "${opt.name}"`);
				options[opt.name] = attachment;
				break;
			}
			case ApplicationCommandOptionType.User: {
				const user = resolved?.users?.[opt.value];
				if (!user) throw new Error(`Resolved user not found for option "${opt.name}"`);
				options[opt.name] = { user, member: resolved?.members?.[opt.value] };
				break;
			}
			case ApplicationCommandOptionType.Channel: {
				const channel = resolved?.channels?.[opt.value];
				if (!channel) throw new Error(`Resolved channel not found for option "${opt.name}"`);
				options[opt.name] = channel;
				break;
			}
			case ApplicationCommandOptionType.Role: {
				const role = resolved?.roles?.[opt.value];
				if (!role) throw new Error(`Resolved role not found for option "${opt.name}"`);
				options[opt.name] = role;
				break;
			}
			case ApplicationCommandOptionType.Mentionable: {
				const user = resolved?.users?.[opt.value];
				if (user) {
					options[opt.name] = { user, member: resolved?.members?.[opt.value] };
				} else {
					const role = resolved?.roles?.[opt.value];
					if (!role) throw new Error(`Resolved mentionable not found for option "${opt.name}"`);
					options[opt.name] = role;
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
