import type { MessageCommandContext } from "../types/contexts.ts";
import { DefinitionType, type ContextMenuCommandData, type MessageCommandDefinition } from "../types/definitions.ts";
import type { CommandHooks } from "../types/hooks.ts";

export interface DefineMessageCommandConfig {
	data: ContextMenuCommandData;
	hooks?: CommandHooks;
	handler: (ctx: MessageCommandContext) => void | Promise<void>;
}

export function defineMessageCommand(config: DefineMessageCommandConfig): MessageCommandDefinition {
	return {
		type: DefinitionType.MessageCommand,
		data: config.data,
		hooks: config.hooks,
		handler: config.handler,
	};
}
