import type { ButtonContext } from "../types/contexts.ts";
import { DefinitionType, type ButtonDefinition } from "../types/definitions.ts";
import type { HandlerHooks } from "../types/hooks.ts";

export interface DefineButtonConfig {
	customId: string | RegExp;
	hooks?: HandlerHooks<ButtonContext>;
	handler: (ctx: ButtonContext) => void | Promise<void>;
}

/** Defines a button interaction handler matched by a regex or exact string on `customId`. Named capture groups become `ctx.params`. */
export function defineButton(config: DefineButtonConfig): ButtonDefinition {
	return {
		type: DefinitionType.Button,
		customId: config.customId,
		hooks: config.hooks,
		handler: config.handler,
	};
}
