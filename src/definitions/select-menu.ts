import type { SelectMenuContext } from "../types/contexts.ts";
import { DefinitionType, type SelectMenuDefinition } from "../types/definitions.ts";

export interface DefineSelectMenuConfig {
	customId: RegExp;
	handler: (ctx: SelectMenuContext) => Promise<void>;
}

/** Defines a select menu handler matched by a regex on `customId`. Selected values are in `ctx.values`. */
export function defineSelectMenu(config: DefineSelectMenuConfig): SelectMenuDefinition {
	return {
		type: DefinitionType.SelectMenu,
		customId: config.customId,
		handler: config.handler,
	};
}
