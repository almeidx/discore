import { API } from "@discordjs/core";
import { REST } from "@discordjs/rest";
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
	type SubcommandGroup,
} from "./types/definitions.ts";

export interface PublishCommandsOptions {
	token: string;
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
		options: [...cmd.data.options] as APIApplicationCommandOption[],
	};
}

function commandGroupToPayload(group: CommandGroupDefinition): CommandPayload {
	const options: APIApplicationCommandOption[] = group.subcommands.map((entry) => {
		if ("type" in entry) {
			return {
				...entry.data,
				type: ApplicationCommandOptionType.Subcommand as number,
				options: [...entry.data.options],
			} as APIApplicationCommandOption;
		}

		const subGroup: SubcommandGroup = entry;
		return {
			name: subGroup.name,
			description: subGroup.description,
			type: ApplicationCommandOptionType.SubcommandGroup as number,
			options: subGroup.subcommands.map((sub) => ({
				...sub.data,
				type: ApplicationCommandOptionType.Subcommand as number,
				options: [...sub.data.options],
			})),
		} as APIApplicationCommandOption;
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
	const rest = new REST().setToken(options.token);
	const api = new API(rest);

	const payloads = options.commands.map(toPayload);

	const appInfo = await api.applications.getCurrent();
	const applicationId = appInfo.id;

	if (options.guildId) {
		return api.applicationCommands.bulkOverwriteGuildCommands(applicationId, options.guildId, payloads);
	}

	return api.applicationCommands.bulkOverwriteGlobalCommands(applicationId, payloads);
}
