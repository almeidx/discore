import type { GatewayDispatchEvents } from "discord-api-types/v10";
import type { EventContext } from "../types/contexts.ts";
import { DefinitionType, type EventDefinition } from "../types/definitions.ts";
import type { GatewayEventData } from "../types/events.ts";
import type { HandlerHooks } from "../types/hooks.ts";

export interface DefineEventConfig<E extends GatewayDispatchEvents> {
	event: E;
	priority?: number;
	once?: boolean;
	hooks?: HandlerHooks<EventContext<GatewayEventData<E>>>;
	handler: (ctx: EventContext<GatewayEventData<E>>) => void | Promise<void>;
}

export function defineEvent<E extends GatewayDispatchEvents>(config: DefineEventConfig<E>): EventDefinition {
	return {
		type: DefinitionType.Event,
		event: config.event,
		priority: config.priority ?? 0,
		once: config.once,
		hooks: config.hooks as EventDefinition["hooks"],
		handler: config.handler as EventDefinition["handler"],
	};
}
