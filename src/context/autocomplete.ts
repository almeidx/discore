import type { API } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type {
	APIApplicationCommandAutocompleteInteraction,
	APIApplicationCommandOptionChoice,
} from "discord-api-types/v10";
import { ApplicationCommandOptionType } from "discord-api-types/v10";
import type { AutocompleteContext } from "../types/contexts.ts";

export function createAutocompleteContext(
	api: API,
	gateway: WebSocketManager,
	interaction: APIApplicationCommandAutocompleteInteraction,
): AutocompleteContext {
	const focused = findFocusedOption(interaction);

	return {
		api,
		gateway,
		interaction,
		focused,

		async respond(choices: APIApplicationCommandOptionChoice[]): Promise<void> {
			await api.interactions.createAutocompleteResponse(interaction.id, interaction.token, {
				choices,
			});
		},
	};
}

function findFocusedOption(interaction: APIApplicationCommandAutocompleteInteraction): {
	name: string;
	value: string | number;
} {
	const options = interaction.data.options ?? [];

	for (const opt of options) {
		if (
			opt.type === ApplicationCommandOptionType.Subcommand ||
			opt.type === ApplicationCommandOptionType.SubcommandGroup
		) {
			const subOptions = opt.options ?? [];
			for (const sub of subOptions) {
				if (sub.type === ApplicationCommandOptionType.Subcommand) {
					for (const inner of sub.options ?? []) {
						if ("focused" in inner && inner.focused) {
							return { name: inner.name, value: inner.value as string | number };
						}
					}
				}
				if ("focused" in sub && sub.focused) {
					return { name: sub.name, value: sub.value as string | number };
				}
			}
		}
		if ("focused" in opt && opt.focused) {
			return { name: opt.name, value: opt.value as string | number };
		}
	}

	throw new Error("No focused option found in autocomplete interaction");
}
