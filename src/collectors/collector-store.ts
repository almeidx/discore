import type { ComponentInteractionContext } from "../types/internal.ts";

export interface ActiveCollector {
	filter: (ctx: ComponentInteractionContext) => boolean;
	handle: (ctx: ComponentInteractionContext) => void;
}

export interface CollectorStore {
	register(collector: ActiveCollector): void;
	unregister(collector: ActiveCollector): void;
	dispatch(ctx: ComponentInteractionContext): boolean;
}

export function createCollectorStore(): CollectorStore {
	const collectors = new Set<ActiveCollector>();

	return {
		register(collector: ActiveCollector): void {
			collectors.add(collector);
		},

		unregister(collector: ActiveCollector): void {
			collectors.delete(collector);
		},

		dispatch(ctx: ComponentInteractionContext): boolean {
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
