import type { ButtonContext, SelectMenuContext } from "./contexts.ts";

export type ComponentInteractionContext = ButtonContext | SelectMenuContext;

export interface CollectorEntry {
	filter: (ctx: ComponentInteractionContext) => boolean;
	resolve: (ctx: ComponentInteractionContext) => void;
}
