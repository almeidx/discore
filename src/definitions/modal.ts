import type { ModalContext } from "../types/contexts.ts";
import { DefinitionType, type ModalDefinition } from "../types/definitions.ts";
import type { HandlerHooks } from "../types/hooks.ts";

export interface DefineModalConfig {
	customId: string | RegExp;
	hooks?: HandlerHooks<ModalContext>;
	handler: (ctx: ModalContext) => void | Promise<void>;
}

/** Defines a modal submission handler matched by a regex or exact string on `customId`. Access field values via `ctx.fields`. */
export function defineModal(config: DefineModalConfig): ModalDefinition {
	return {
		type: DefinitionType.Modal,
		customId: config.customId,
		hooks: config.hooks,
		handler: config.handler,
	};
}
