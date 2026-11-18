export interface ActiveCollector<T> {
	filter: (ctx: T) => boolean;
	handle: (ctx: T) => void;
}

/** What every collector needs: which interactions to take and how long to wait for them. */
export interface CollectorOptions<T> {
	filter: (ctx: T) => boolean;
	timeout: number;
}

export interface CollectorStore<T> {
	register(collector: ActiveCollector<T>): void;
	unregister(collector: ActiveCollector<T>): void;
	dispatch(ctx: T): boolean;
}

export function createCollectorStore<T>(): CollectorStore<T> {
	const collectors = new Set<ActiveCollector<T>>();

	return {
		register(collector: ActiveCollector<T>): void {
			collectors.add(collector);
		},

		unregister(collector: ActiveCollector<T>): void {
			collectors.delete(collector);
		},

		dispatch(ctx: T): boolean {
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
