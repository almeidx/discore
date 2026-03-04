import type { ButtonContext } from "../types/contexts.ts";
import { DefinitionType, type ButtonDefinition } from "../types/definitions.ts";

export interface DefineButtonConfig {
	customId: RegExp;
	handler: (ctx: ButtonContext) => Promise<void>;
}

/** Defines a button interaction handler matched by a regex on `customId`. Named capture groups become `ctx.params`. */
export function defineButton(config: DefineButtonConfig): ButtonDefinition {
	return {
		type: DefinitionType.Button,
		customId: config.customId,
		handler: config.handler,
	};
}
