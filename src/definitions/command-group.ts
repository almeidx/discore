import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord-api-types/v10";
import {
	DefinitionType,
	type CommandDefinition,
	type CommandGroupDefinition,
	type SubcommandGroup,
} from "../types/definitions.ts";
import type { CommandHooks } from "../types/hooks.ts";

export interface DefineCommandGroupConfig {
	data: Omit<RESTPostAPIChatInputApplicationCommandsJSONBody, "type" | "options">;
	requiredBotPermissions?: bigint;
	/** Hooks that apply to all subcommands in this group unless the subcommand defines its own. */
	hooks?: CommandHooks;
	subcommands: (CommandDefinition | SubcommandGroup)[];
}

export function defineCommandGroup(config: DefineCommandGroupConfig): CommandGroupDefinition {
	return {
		type: DefinitionType.CommandGroup,
		data: config.data,
		requiredBotPermissions: config.requiredBotPermissions,
		hooks: config.hooks,
		subcommands: config.subcommands,
	};
}
