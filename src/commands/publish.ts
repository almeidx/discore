import type { API } from "@discordjs/core";
import {
	ApplicationCommandType,
	type APIApplicationCommand,
	type APIApplicationCommandOption,
	type RESTPostAPIChatInputApplicationCommandsJSONBody,
	type RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import { DefinitionType } from "../definition-type.ts";
import { commandGroupToPayload } from "./command-group.ts";
import type { AnyCommandDefinition } from "./router.ts";

export interface PublishCommandsOptions {
	api: API;
	applicationId: string;
	commands: AnyCommandDefinition[];
	guildId?: string;
}

export type CommandPayload =
	| RESTPostAPIChatInputApplicationCommandsJSONBody
	| RESTPostAPIContextMenuApplicationCommandsJSONBody;

export function commandToPayload(cmd: AnyCommandDefinition): CommandPayload {
	switch (cmd.type) {
		case DefinitionType.Command:
			return {
				...cmd.data,
				type: ApplicationCommandType.ChatInput,
				options: [...cmd.data.options] as APIApplicationCommandOption[],
			};
		case DefinitionType.CommandGroup:
			return commandGroupToPayload(cmd);
		case DefinitionType.UserCommand:
			return { ...cmd.data, type: ApplicationCommandType.User };
		case DefinitionType.MessageCommand:
			return { ...cmd.data, type: ApplicationCommandType.Message };
	}
}

export async function publishCommands(options: PublishCommandsOptions): Promise<APIApplicationCommand[]> {
	const payloads = options.commands.map(commandToPayload);

	if (options.guildId) {
		return options.api.applicationCommands.bulkOverwriteGuildCommands(options.applicationId, options.guildId, payloads);
	}

	return options.api.applicationCommands.bulkOverwriteGlobalCommands(options.applicationId, payloads);
}
