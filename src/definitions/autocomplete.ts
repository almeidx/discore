import type { AutocompleteContext } from "../types/contexts.ts";
import { DefinitionType, type AutocompleteDefinition } from "../types/definitions.ts";

export interface DefineAutocompleteConfig {
	command: string;
	option: string;
	handler: (ctx: AutocompleteContext) => Promise<void>;
}

/** Defines an autocomplete handler for a specific command option. */
export function defineAutocomplete(config: DefineAutocompleteConfig): AutocompleteDefinition {
	return {
		type: DefinitionType.Autocomplete,
		command: config.command,
		option: config.option,
		handler: config.handler,
	};
}
