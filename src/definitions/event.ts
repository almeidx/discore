import type { EventContext } from "../types/contexts.ts";
import { DefinitionType, type EventDefinition } from "../types/definitions.ts";

export interface DefineEventConfig<TEvent = unknown> {
	event: string;
	priority?: number;
	handler: (ctx: EventContext<TEvent>) => Promise<void>;
}

/** Defines a gateway event handler with optional priority ordering. Lower priority values execute first. */
export function defineEvent<TEvent = unknown>(config: DefineEventConfig<TEvent>): EventDefinition<TEvent> {
	return {
		type: DefinitionType.Event,
		event: config.event,
		priority: config.priority ?? 0,
		handler: config.handler,
	};
}
