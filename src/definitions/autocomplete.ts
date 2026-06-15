import type { AutocompleteContext } from "../types/contexts.ts";
import { DefinitionType, type AutocompleteDefinition } from "../types/definitions.ts";
import type { HandlerHooks } from "../types/hooks.ts";

export interface DefineAutocompleteConfig {
	/**
	 * Command to match. Accepts:
	 * - `"command"` — matches by command name (any subcommand)
	 * - `["command", "subcommand"]` — matches command + subcommand
	 * - `["command", "group", "subcommand"]` — matches command + subcommand group + subcommand
	 */
	command: string | [string, string] | [string, string, string];
	option: string;
	hooks?: HandlerHooks<AutocompleteContext>;
	handler: (ctx: AutocompleteContext) => void | Promise<void>;
}

/** Defines an autocomplete handler for a specific command option. */
export function defineAutocomplete(config: DefineAutocompleteConfig): AutocompleteDefinition {
	return {
		type: DefinitionType.Autocomplete,
		command: config.command,
		option: config.option,
		hooks: config.hooks,
		handler: config.handler,
	};
}
