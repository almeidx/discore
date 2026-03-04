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

	const options: Record<string, unknown> = {};

	for (const opt of rawOptions) {
		if (opt.type === ApplicationCommandOptionType.Attachment) {
			const attachmentId = opt.value as string;
			const resolved = data.resolved?.attachments?.[attachmentId];
			options[opt.name] = resolved;
		} else {
			options[opt.name] = opt.value;
		}
	}

	return { options, subcommand, subcommandGroup };
}
