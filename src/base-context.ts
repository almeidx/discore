import type { API } from "@discordjs/core";
import type { WebSocketManager } from "@discordjs/ws";
import type { Bot } from "./bot.ts";

export interface BaseContext {
	api: API;
	readonly bot: Bot;
	gateway: WebSocketManager;
}

export function createBaseContext(bot: Bot): BaseContext {
	return { api: bot.api, bot, gateway: bot.gateway };
}
