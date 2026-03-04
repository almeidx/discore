import type { ModalContext } from "../types/contexts.ts";

export interface ActiveModalCollector {
	filter: (ctx: ModalContext) => boolean;
	handle: (ctx: ModalContext) => void;
}

export interface ModalCollectorStore {
	register(collector: ActiveModalCollector): void;
	unregister(collector: ActiveModalCollector): void;
	dispatch(ctx: ModalContext): boolean;
}

export function createModalCollectorStore(): ModalCollectorStore {
	const collectors = new Set<ActiveModalCollector>();

	return {
		register(collector: ActiveModalCollector): void {
			collectors.add(collector);
		},

		unregister(collector: ActiveModalCollector): void {
			collectors.delete(collector);
		},

		dispatch(ctx: ModalContext): boolean {
			let handled = false;
			for (const collector of collectors) {
				if (collector.filter(ctx)) {
					collector.handle(ctx);
					handled = true;
				}
			}
			return handled;
		},
	};
}
