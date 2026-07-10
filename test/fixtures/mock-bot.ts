import { Collection } from "@discordjs/collection";
import type { Bot } from "../../src/bot.ts";
import { DefinitionType } from "../../src/types/definitions.ts";
import { createMockAPI } from "./mock-api.ts";
import { createMockGateway } from "./mock-gateway.ts";

export function createMockBot(
	api: Bot["api"] = createMockAPI(),
	gateway: Bot["gateway"] = createMockGateway() as unknown as Bot["gateway"],
	ping?: number,
): Bot {
	const commands: Bot["commands"] = new Collection();
	const commandGroups: Bot["commandGroups"] = new Collection();
	const userCommands: Bot["userCommands"] = new Collection();
	const messageCommands: Bot["messageCommands"] = new Collection();
	const events = new Set<Parameters<Bot["addEvent"]>[0]>();
	const interactions = new Set<Parameters<Bot["addInteraction"]>[0]>();

	return {
		api,
		gateway,
		get ping() {
			return ping;
		},
		commands,
		commandGroups,
		userCommands,
		messageCommands,

		addCommand(command) {
			switch (command.type) {
				case DefinitionType.CommandGroup:
					commandGroups.set(command.data.name, command);
					break;
				case DefinitionType.UserCommand:
					userCommands.set(command.data.name, command);
					break;
				case DefinitionType.MessageCommand:
					messageCommands.set(command.data.name, command);
					break;
				default:
					commands.set(command.data.name, command);
					break;
			}
		},

		removeCommand(name) {
			return (
				commands.delete(name) || commandGroups.delete(name) || userCommands.delete(name) || messageCommands.delete(name)
			);
		},

		addEvent(event) {
			events.add(event);
		},

		removeEvent(event) {
			return events.delete(event);
		},

		addInteraction(interaction) {
			interactions.add(interaction);
		},

		removeInteraction(interaction) {
			return interactions.delete(interaction);
		},

		destroy() {},
	};
}
