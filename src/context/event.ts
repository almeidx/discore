import type { Bot } from "../bot.ts";
import type { EventContext } from "../types/contexts.ts";
import { createBaseContext } from "./base.ts";

export function createEventContext<TEvent>(bot: Bot, event: TEvent, shardId: number): EventContext<TEvent> {
	return { ...createBaseContext(bot), event, shardId };
}
