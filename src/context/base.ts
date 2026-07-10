import type { Bot } from "../bot.ts";
import type { BaseContext } from "../types/contexts.ts";

export function createBaseContext(bot: Bot): BaseContext {
	return { api: bot.api, bot, gateway: bot.gateway };
}
