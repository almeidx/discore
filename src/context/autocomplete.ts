import type { API } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type {
	APIApplicationCommandAutocompleteInteraction,
	APIApplicationCommandOptionChoice,
} from "discord-api-types/v10";
import { ApplicationCommandOptionType } from "discord-api-types/v10";
import type { AutocompleteContext } from "../types/contexts.ts";

export interface ManagedAutocompleteContext {
	context: AutocompleteContext;
	hasResponded(): boolean;
}

export function createManagedAutocompleteContext(
	api: API,
	gateway: WebSocketManager,
	interaction: APIApplicationCommandAutocompleteInteraction,
): ManagedAutocompleteContext {
	const { focused, options, subcommand, subcommandGroup } = parseAutocompleteOptions(interaction);
	let responded = false;

	const context: AutocompleteContext = {
		api,
		gateway,
		interaction,
		focused,
		options,
		subcommand,
		subcommandGroup,

		async respond(choices: APIApplicationCommandOptionChoice[]): Promise<void> {
			await api.interactions.createAutocompleteResponse(interaction.id, interaction.token, {
				choices,
			});
			responded = true;
		},
	};

	return {
		context,
		hasResponded() {
			return responded;
		},
	};
}

export function createAutocompleteContext(
	api: API,
	gateway: WebSocketManager,
	interaction: APIApplicationCommandAutocompleteInteraction,
): AutocompleteContext {
	return createManagedAutocompleteContext(api, gateway, interaction).context;
}

interface AutocompleteParseResult {
	focused: { name: string; value: string | number };
	options: Record<string, string | number | boolean>;
	subcommand: string | undefined;
	subcommandGroup: string | undefined;
}

function parseAutocompleteOptions(interaction: APIApplicationCommandAutocompleteInteraction): AutocompleteParseResult {
	const allOptions = interaction.data.options ?? [];
	let focused: { name: string; value: string | number } | undefined;
	const options: Record<string, string | number | boolean> = {};
	let subcommand: string | undefined;
	let subcommandGroup: string | undefined;

	function processBasicOptions(opts: typeof allOptions): void {
		for (const opt of opts) {
			if (
				opt.type === ApplicationCommandOptionType.SubcommandGroup ||
				opt.type === ApplicationCommandOptionType.Subcommand
			) {
				continue;
			}

			if ("focused" in opt && opt.focused) {
				focused = { name: opt.name, value: opt.value };
			}
			options[opt.name] = opt.value as string | number | boolean;
		}
	}

	for (const opt of allOptions) {
		if (opt.type === ApplicationCommandOptionType.SubcommandGroup) {
			subcommandGroup = opt.name;
			const subOptions = opt.options ?? [];
			for (const sub of subOptions) {
				if (sub.type === ApplicationCommandOptionType.Subcommand) {
					subcommand = sub.name;
					processBasicOptions(sub.options ?? []);
				}
			}
		} else if (opt.type === ApplicationCommandOptionType.Subcommand) {
			subcommand = opt.name;
			processBasicOptions(opt.options ?? []);
		}
	}

	if (!subcommand && !subcommandGroup) {
		processBasicOptions(allOptions);
	}

	if (!focused) {
		throw new Error("No focused option found in autocomplete interaction");
	}

	return { focused, options, subcommand, subcommandGroup };
}
