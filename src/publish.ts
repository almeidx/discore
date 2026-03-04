import { API } from "@discordjs/core";
import { REST } from "@discordjs/rest";
import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	type RESTPostAPIChatInputApplicationCommandsJSONBody,
	type APIApplicationCommandOption,
} from "discord-api-types/v10";
import {
	DefinitionType,
	type AnyCommandDefinition,
	type CommandDefinition,
	type CommandGroupDefinition,
} from "./types/definitions.ts";

export interface PublishCommandsOptions {
	token: string;
	commands: AnyCommandDefinition[];
	guildId?: string;
}

function commandToPayload(cmd: CommandDefinition): RESTPostAPIChatInputApplicationCommandsJSONBody {
	return {
		...cmd.data,
		type: ApplicationCommandType.ChatInput,
		options: [...cmd.data.options] as APIApplicationCommandOption[],
	};
}

function commandGroupToPayload(group: CommandGroupDefinition): RESTPostAPIChatInputApplicationCommandsJSONBody {
	return {
		...group.data,
		type: ApplicationCommandType.ChatInput,
		options: group.subcommands.map((sub) => ({
			...sub.data,
			type: ApplicationCommandOptionType.Subcommand as number,
			options: [...sub.data.options],
		})) as APIApplicationCommandOption[],
	};
}

/**
 * Publishes command definitions to Discord.
 * Registers globally by default, or to a specific guild if `guildId` is provided.
 */
export async function publishCommands(options: PublishCommandsOptions): Promise<void> {
	const rest = new REST().setToken(options.token);
	const api = new API(rest);

	const payloads = options.commands.map((cmd) =>
		cmd.type === DefinitionType.CommandGroup ? commandGroupToPayload(cmd) : commandToPayload(cmd),
	);

	const appInfo = await api.applications.getCurrent();
	const applicationId = appInfo.id;

	if (options.guildId) {
		await api.applicationCommands.bulkOverwriteGuildCommands(applicationId, options.guildId, payloads);
	} else {
		await api.applicationCommands.bulkOverwriteGlobalCommands(applicationId, payloads);
	}
}
