import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord-api-types/v10";
import { DefinitionType, type CommandDefinition, type CommandGroupDefinition } from "../types/definitions.ts";

export interface DefineCommandGroupConfig {
	data: Omit<RESTPostAPIChatInputApplicationCommandsJSONBody, "type" | "options">;
	subcommands: CommandDefinition[];
}

/** Defines a command group that nests multiple subcommands under one top-level command. */
export function defineCommandGroup(config: DefineCommandGroupConfig): CommandGroupDefinition {
	return {
		type: DefinitionType.CommandGroup,
		data: config.data,
		subcommands: config.subcommands,
	};
}
