import type { SelectMenuContext } from "../types/contexts.ts";
import { DefinitionType, type SelectMenuDefinition } from "../types/definitions.ts";
import type { HandlerHooks } from "../types/hooks.ts";

export interface DefineSelectMenuConfig {
	customId: string | RegExp;
	hooks?: HandlerHooks<SelectMenuContext>;
	handler: (ctx: SelectMenuContext) => void | Promise<void>;
}

/** Defines a select menu handler matched by a regex or exact string on `customId`. Selected values are in `ctx.values`. */
export function defineSelectMenu(config: DefineSelectMenuConfig): SelectMenuDefinition {
	return {
		type: DefinitionType.SelectMenu,
		customId: config.customId,
		hooks: config.hooks,
		handler: config.handler,
	};
}
