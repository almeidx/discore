import type { AwaitModalOptions, ModalContext } from "../types/contexts.ts";
import type { CollectorStore } from "./collector-store.ts";
import { CollectorTimeoutError } from "./errors.ts";

export function awaitModal(store: CollectorStore<ModalContext>, options: AwaitModalOptions): Promise<ModalContext> {
	return new Promise<ModalContext>((resolve, reject) => {
		const timer = setTimeout(() => {
			store.unregister(collector);
			reject(new CollectorTimeoutError(options.timeout));
		}, options.timeout);

		const collector = {
			filter: options.filter,
			handle(ctx: ModalContext) {
				clearTimeout(timer);
				store.unregister(collector);
				resolve(ctx);
			},
		};

		store.register(collector);
	});
}
