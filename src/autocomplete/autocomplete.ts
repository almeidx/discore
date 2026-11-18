import type {
	APIApplicationCommandAutocompleteInteraction,
	APIApplicationCommandOptionChoice,
} from "discord-api-types/v10";
import { createBaseContext, type BaseContext } from "../base-context.ts";
import type { Bot } from "../bot.ts";
import { parseCommandPath } from "../commands/options.ts";
import { DefinitionType } from "../definition-type.ts";
import type { HandlerHooks } from "../hooks.ts";

/** Context passed to autocomplete handlers. */
export interface AutocompleteContext extends BaseContext {
	interaction: APIApplicationCommandAutocompleteInteraction;
	focused: { name: string; value: string | number };
	options: Record<string, string | number | boolean>;
	subcommand: string | undefined;
	subcommandGroup: string | undefined;
	respond(choices: APIApplicationCommandOptionChoice[]): Promise<void>;
}

export interface AutocompleteDefinition {
	type: typeof DefinitionType.Autocomplete;
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

export type DefineAutocompleteConfig = Omit<AutocompleteDefinition, "type">;

/** Defines an autocomplete handler for a specific command option. */
export function defineAutocomplete(config: DefineAutocompleteConfig): AutocompleteDefinition {
	return { ...config, type: DefinitionType.Autocomplete };
}

export function matchesAutocomplete(def: AutocompleteDefinition, ctx: AutocompleteContext): boolean {
	const commandName = ctx.interaction.data.name;
	if (def.option !== ctx.focused.name) return false;
	if (typeof def.command === "string") return def.command === commandName;

	const [command, ...rest] = def.command;
	if (command !== commandName || rest.at(-1) !== ctx.subcommand) return false;
	return rest.length === 1 || rest[0] === ctx.subcommandGroup;
}

export interface ManagedAutocompleteContext {
	context: AutocompleteContext;
	hasResponded(): boolean;
}

export function createAutocompleteContext(
	bot: Bot,
	interaction: APIApplicationCommandAutocompleteInteraction,
): ManagedAutocompleteContext {
	const { subcommandGroup, subcommand, options: leafOptions } = parseCommandPath(interaction.data.options);
	let focused: AutocompleteContext["focused"] | undefined;
	const options: AutocompleteContext["options"] = {};

	for (const opt of leafOptions) {
		if ("focused" in opt && opt.focused) {
			focused = { name: opt.name, value: opt.value };
		}
		options[opt.name] = opt.value as string | number | boolean;
	}

	if (!focused) {
		throw new Error("No focused option found in autocomplete interaction");
	}

	let responded = false;

	const context: AutocompleteContext = {
		...createBaseContext(bot),
		interaction,
		focused,
		options,
		subcommand,
		subcommandGroup,

		async respond(choices: APIApplicationCommandOptionChoice[]): Promise<void> {
			await bot.api.interactions.createAutocompleteResponse(interaction.id, interaction.token, { choices });
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
