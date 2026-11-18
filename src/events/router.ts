import type { GatewayDispatchEvents } from "discord-api-types/v10";
import type { Bot } from "../bot.ts";
import type { GlobalHooks } from "../hooks.ts";
import { removeItem } from "../remove-item.ts";
import { throwCollected } from "../throw-collected.ts";
import { createEventContext, type EventDefinition } from "./event.ts";

export interface EventRouter {
	add(def: EventDefinition): void;
	remove(def: EventDefinition): boolean;
	dispatch(event: GatewayDispatchEvents, data: unknown, shardId: number): Promise<void>;
}

export function createEventRouter(config: { bot: Bot; hooks: GlobalHooks }): EventRouter {
	const { bot, hooks } = config;
	const handlers = new Map<GatewayDispatchEvents, EventDefinition[]>();

	function remove(def: EventDefinition): boolean {
		const list = handlers.get(def.event);
		if (!list || !removeItem(list, def)) return false;
		if (list.length === 0) handlers.delete(def.event);
		return true;
	}

	return {
		add(def) {
			const list = handlers.get(def.event) ?? [];
			list.push(def);
			list.sort((a, b) => a.priority - b.priority);
			handlers.set(def.event, list);
		},

		remove,

		async dispatch(event, data, shardId) {
			const registered = handlers.get(event)?.slice();
			if (!registered) return;

			const errors: unknown[] = [];

			for (const def of registered) {
				if (def.once) remove(def);

				const ctx = createEventContext(bot, data, shardId);
				try {
					await def.handler(ctx);
				} catch (error) {
					try {
						if (def.hooks?.onError && (await def.hooks.onError(ctx, error)) === false) continue;
					} catch (hookError) {
						errors.push(hookError);
					}

					if (!hooks.onEventError) {
						errors.push(error);
						continue;
					}
					try {
						await hooks.onEventError(ctx, error);
					} catch (hookError) {
						errors.push(hookError);
					}
				}
			}

			throwCollected(errors, "Multiple event handlers failed");
		},
	};
}
