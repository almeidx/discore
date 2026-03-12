import type { AwaitComponentOptions } from "../types/contexts.ts";
import type { ComponentInteractionContext } from "../types/internal.ts";
import type { CollectorStore } from "./collector-store.ts";
import { CollectorTimeoutError } from "./errors.ts";

export function awaitComponent(
	store: CollectorStore<ComponentInteractionContext>,
	options: AwaitComponentOptions,
): Promise<ComponentInteractionContext> {
	return new Promise<ComponentInteractionContext>((resolve, reject) => {
		const timer = setTimeout(() => {
			store.unregister(collector);
			reject(new CollectorTimeoutError(options.timeout));
		}, options.timeout);

		const collector = {
			filter: options.filter,
			handle(ctx: ComponentInteractionContext) {
				clearTimeout(timer);
				store.unregister(collector);
				resolve(ctx);
			},
		};

		store.register(collector);
	});
}
