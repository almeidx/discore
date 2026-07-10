import type { GatewayDispatchEvents } from "discord-api-types/v10";
import type { Bot } from "../bot.ts";
import { createEventContext } from "../context/event.ts";
import type { EventDefinition } from "../types/definitions.ts";
import type { GlobalHooks } from "../types/hooks.ts";

export interface EventRouter {
	dispatch(event: GatewayDispatchEvents, data: unknown, bot: Bot, shardId: number): Promise<void>;
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
		async dispatch(event, data, bot, shardId) {
			const registered = handlerMap.get(event);
			if (!registered || registered.length === 0) return;
			const handlers = [...registered];

			const errors: unknown[] = [];

			for (const def of handlers) {
				if (def.once) {
					removeFromMap(def);
				}

				const ctx = createEventContext(bot, data, shardId);
				try {
					await def.handler(ctx);
				} catch (error) {
					let suppressed = false;
					if (def.hooks?.onError) {
						try {
							if ((await def.hooks.onError(ctx, error)) === false) suppressed = true;
						} catch (hookError) {
							errors.push(hookError);
						}
					}
					if (suppressed) continue;

					if (hooks.onEventError) {
						try {
							await hooks.onEventError(ctx, error);
						} catch (hookError) {
							errors.push(hookError);
						}
					} else {
						errors.push(error);
					}
				}
			}

			if (errors.length === 1) {
				throw errors[0];
			} else if (errors.length > 1) {
				throw new AggregateError(errors, "Multiple event handlers failed");
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
