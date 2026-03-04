import type { ModalContext } from "../types/contexts.ts";
import { DefinitionType, type ModalDefinition } from "../types/definitions.ts";

export interface DefineModalConfig {
	customId: RegExp;
	handler: (ctx: ModalContext) => Promise<void>;
}

/** Defines a modal submission handler matched by a regex on `customId`. Access field values via `ctx.fields`. */
export function defineModal(config: DefineModalConfig): ModalDefinition {
	return {
		type: DefinitionType.Modal,
		customId: config.customId,
		handler: config.handler,
	};
}
