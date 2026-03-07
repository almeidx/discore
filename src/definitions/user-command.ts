import type { UserCommandContext } from "../types/contexts.ts";
import { DefinitionType, type ContextMenuCommandData, type UserCommandDefinition } from "../types/definitions.ts";
import type { CommandHooks } from "../types/hooks.ts";

export interface DefineUserCommandConfig {
	data: ContextMenuCommandData;
	hooks?: CommandHooks;
	handler: (ctx: UserCommandContext) => void | Promise<void>;
}

export function defineUserCommand(config: DefineUserCommandConfig): UserCommandDefinition {
	return {
		type: DefinitionType.UserCommand,
		data: config.data,
		hooks: config.hooks,
		handler: config.handler,
	};
}
