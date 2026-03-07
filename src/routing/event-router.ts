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
	addHandler(def: EventDefinition): void;
	removeHandler(def: EventDefinition): boolean;
}

export function createEventRouter(events: EventDefinition[], hooks: GlobalHooks): EventRouter {
	const handlerMap = new Map<GatewayDispatchEvents, EventDefinition[]>();

	function addToMap(def: EventDefinition): void {
		const existing = handlerMap.get(def.event) ?? [];
		existing.push(def);
		existing.sort((a, b) => a.priority - b.priority);
		handlerMap.set(def.event, existing);
	}

	function removeFromMap(def: EventDefinition): boolean {
		const existing = handlerMap.get(def.event);
		if (!existing) return false;
		const idx = existing.indexOf(def);
		if (idx === -1) return false;
		existing.splice(idx, 1);
		if (existing.length === 0) handlerMap.delete(def.event);
		return true;
	}

	for (const def of events) {
		addToMap(def);
	}

	return {
		async dispatch(event, data, api, gateway, shardId) {
			const handlers = handlerMap.get(event);
			if (!handlers) return;

			const onceHandlers: EventDefinition[] = [];

			await Promise.allSettled(
				handlers.map(async (def) => {
					const ctx = createEventContext(api, gateway, data, shardId);
					try {
						await def.handler(ctx);
						if (def.once) onceHandlers.push(def);
					} catch (error) {
						if (hooks.onEventError) {
							await hooks.onEventError(ctx, error);
						}
					}
				}),
			);

			for (const def of onceHandlers) {
				removeFromMap(def);
			}
		},

		addHandler(def) {
			addToMap(def);
		},

		removeHandler(def) {
			return removeFromMap(def);
		},
	};
}
