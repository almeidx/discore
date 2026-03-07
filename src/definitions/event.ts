import type { GatewayDispatchEvents } from "discord-api-types/v10";
import type { EventContext } from "../types/contexts.ts";
import { DefinitionType, type EventDefinition } from "../types/definitions.ts";
import type { GatewayEventData } from "../types/events.ts";

export interface DefineEventConfig<E extends GatewayDispatchEvents> {
	event: E;
	priority?: number;
	handler: (ctx: EventContext<GatewayEventData<E>>) => Promise<void>;
}

export function defineEvent<E extends GatewayDispatchEvents>(config: DefineEventConfig<E>): EventDefinition {
	return {
		type: DefinitionType.Event,
		event: config.event,
		priority: config.priority ?? 0,
		handler: config.handler as EventDefinition["handler"],
	};
}
