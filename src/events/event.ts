import type { GatewayDispatchEvents, GatewayDispatchPayload } from "discord-api-types/v10";
import { createBaseContext, type BaseContext } from "../base-context.ts";
import type { Bot } from "../bot.ts";
import { DefinitionType } from "../definition-type.ts";
import type { HandlerHooks } from "../hooks.ts";

export type GatewayEventData<E extends GatewayDispatchEvents> = Extract<GatewayDispatchPayload, { t: E }>["d"];

export interface EventContext<TEvent = unknown> extends BaseContext {
	event: TEvent;
	shardId: number;
}

export interface EventDefinition {
	type: typeof DefinitionType.Event;
	event: GatewayDispatchEvents;
	priority: number;
	once?: boolean;
	hooks?: HandlerHooks<EventContext>;
	handler: (ctx: EventContext) => void | Promise<void>;
}

export interface DefineEventConfig<E extends GatewayDispatchEvents> extends Pick<EventDefinition, "once"> {
	event: E;
	priority?: number;
	hooks?: HandlerHooks<EventContext<GatewayEventData<E>>>;
	handler: (ctx: EventContext<GatewayEventData<E>>) => void | Promise<void>;
}

export function defineEvent<E extends GatewayDispatchEvents>(config: DefineEventConfig<E>): EventDefinition {
	return {
		...config,
		type: DefinitionType.Event,
		priority: config.priority ?? 0,
		hooks: config.hooks as EventDefinition["hooks"],
		handler: config.handler as EventDefinition["handler"],
	};
}

export function createEventContext<TEvent>(bot: Bot, event: TEvent, shardId: number): EventContext<TEvent> {
	return { ...createBaseContext(bot), event, shardId };
}
