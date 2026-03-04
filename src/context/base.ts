import type { API } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type { BaseContext } from "../types/contexts.ts";

export function createBaseContext(api: API, gateway: WebSocketManager): BaseContext {
	return { api, gateway };
}
