import type { API } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type { GatewayDispatchEvents } from "discord-api-types/v10";
import { createEventContext } from "../context/event.ts";
import type { EventDefinition } from "../types/definitions.ts";
import type { GlobalHooks } from "../types/hooks.ts";

export interface EventRouter {
	dispatch(
		event: GatewayDispatchEvents,
		data: unknown,
		api: API,
		gateway: WebSocketManager,
		shardId: number,
	): Promise<void>;
}

// EventDefinition<any> is needed because specific event types (e.g. EventDefinition<GatewayDispatchEvents.Ready>)
// are not assignable to EventDefinition<GatewayDispatchEvents> due to handler contravariance
export function createEventRouter(events: EventDefinition<any>[], hooks: GlobalHooks): EventRouter {
	const handlerMap = new Map<GatewayDispatchEvents, EventDefinition<any>[]>();

	for (const def of events) {
		const existing = handlerMap.get(def.event) ?? [];
		existing.push(def);
		handlerMap.set(def.event, existing);
	}

	for (const [, handlers] of handlerMap) {
		handlers.sort((a, b) => a.priority - b.priority);
	}

	return {
		async dispatch(event, data, api, gateway, shardId) {
			const handlers = handlerMap.get(event);
			if (!handlers) return;

			for (const def of handlers) {
				const ctx = createEventContext(api, gateway, data, shardId);
				try {
					await def.handler(ctx as never);
				} catch (error) {
					if (hooks.onEventError) {
						await hooks.onEventError(ctx, error);
					}
				}
			}
		},
	};
}
