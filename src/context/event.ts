import type { API } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type { EventContext } from "../types/contexts.ts";

export function createEventContext<TEvent>(
	api: API,
	gateway: WebSocketManager,
	event: TEvent,
	shardId: number,
): EventContext<TEvent> {
	return { api, gateway, event, shardId };
}
