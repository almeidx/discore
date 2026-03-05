import type { ModalContext } from "../types/contexts.ts";
import type { AwaitModalOptions } from "../types/contexts.ts";
import { CollectorTimeoutError } from "./errors.ts";
import type { ModalCollectorStore } from "./modal-collector-store.ts";

export function awaitModal(store: ModalCollectorStore, options: AwaitModalOptions): Promise<ModalContext> {
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
