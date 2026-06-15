import type { CollectorStore } from "./collector-store.ts";
import { CollectorTimeoutError } from "./errors.ts";

export interface AwaitFromStoreOptions<T> {
	filter: (ctx: T) => boolean;
	timeout: number;
}

export function awaitFromStore<T>(store: CollectorStore<T>, options: AwaitFromStoreOptions<T>): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => {
			store.unregister(collector);
			reject(new CollectorTimeoutError(options.timeout));
		}, options.timeout);

		const collector = {
			filter: options.filter,
			handle(ctx: T) {
				clearTimeout(timer);
				store.unregister(collector);
				resolve(ctx);
			},
		};

		store.register(collector);
	});
}
