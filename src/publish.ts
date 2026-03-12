import type { API } from "@discordjs/core";
import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	type APIApplicationCommand,
	type RESTPostAPIChatInputApplicationCommandsJSONBody,
	type RESTPostAPIContextMenuApplicationCommandsJSONBody,
	type APIApplicationCommandOption,
} from "discord-api-types/v10";
import {
	DefinitionType,
	type AnyCommandDefinition,
	type CommandDefinition,
	type CommandGroupDefinition,
	type UserCommandDefinition,
	type MessageCommandDefinition,
} from "./types/definitions.ts";

export interface PublishCommandsOptions {
	api: API;
	applicationId: string;
	commands: AnyCommandDefinition[];
	guildId?: string;
}

type CommandPayload =
	| RESTPostAPIChatInputApplicationCommandsJSONBody
	| RESTPostAPIContextMenuApplicationCommandsJSONBody;

function commandToPayload(cmd: CommandDefinition): CommandPayload {
	return {
		...cmd.data,
		type: ApplicationCommandType.ChatInput,
		options: cmd.data.options as APIApplicationCommandOption[],
	};
}

function commandGroupToPayload(group: CommandGroupDefinition): CommandPayload {
	const options = group.subcommands.map((entry): APIApplicationCommandOption => {
		if ("type" in entry) {
			return {
				name: entry.data.name,
				description: entry.data.description,
				type: ApplicationCommandOptionType.Subcommand,
				options: [...entry.data.options],
			};
		}

		return {
			name: entry.name,
			description: entry.description,
			type: ApplicationCommandOptionType.SubcommandGroup,
			options: entry.subcommands.map((sub) => ({
				name: sub.data.name,
				description: sub.data.description,
				type: ApplicationCommandOptionType.Subcommand as const,
				options: [...sub.data.options],
			})),
		};
	});

	return {
		...group.data,
		type: ApplicationCommandType.ChatInput,
		options,
	};
}

function userCommandToPayload(cmd: UserCommandDefinition): CommandPayload {
	return {
		...cmd.data,
		type: ApplicationCommandType.User,
	};
}

function messageCommandToPayload(cmd: MessageCommandDefinition): CommandPayload {
	return {
		...cmd.data,
		type: ApplicationCommandType.Message,
	};
}

function toPayload(cmd: AnyCommandDefinition): CommandPayload {
	switch (cmd.type) {
		case DefinitionType.CommandGroup:
			return commandGroupToPayload(cmd);
		case DefinitionType.UserCommand:
			return userCommandToPayload(cmd);
		case DefinitionType.MessageCommand:
			return messageCommandToPayload(cmd);
		default:
			return commandToPayload(cmd);
	}
}

export async function publishCommands(options: PublishCommandsOptions): Promise<APIApplicationCommand[]> {
	const payloads = options.commands.map(toPayload);

	if (options.guildId) {
		return options.api.applicationCommands.bulkOverwriteGuildCommands(options.applicationId, options.guildId, payloads);
	}

	return options.api.applicationCommands.bulkOverwriteGlobalCommands(options.applicationId, payloads);
}
