import type { API } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type { EventDefinition } from "../types/definitions.ts";
import { createEventContext } from "../context/event.ts";

export interface EventRouter {
	dispatch(event: string, data: unknown, api: API, gateway: WebSocketManager, shardId: number): Promise<void>;
}

export function createEventRouter(events: EventDefinition[]): EventRouter {
	const handlerMap = new Map<string, EventDefinition[]>();

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
				await def.handler(ctx);
			}
		},
	};
}
