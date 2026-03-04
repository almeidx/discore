import type { CollectComponentsOptions, ComponentCollector } from "../types/contexts.ts";
import type { ComponentInteractionContext } from "../types/internal.ts";
import type { CollectorStore } from "./collector-store.ts";

interface DeferredPromise<T> {
	resolve: (value: T) => void;
	promise: Promise<T>;
}

function deferred<T>(): DeferredPromise<T> {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { resolve, promise };
}

export function collectComponents(store: CollectorStore, options: CollectComponentsOptions): ComponentCollector {
	const collected: ComponentInteractionContext[] = [];
	const buffer: ComponentInteractionContext[] = [];
	let stopped = false;
	let pending: DeferredPromise<IteratorResult<ComponentInteractionContext>> | null = null;

	function end(reason: "timeout" | "max" | "manual"): void {
		if (stopped) return;
		stopped = true;
		clearTimeout(timer);
		store.unregister(collector);
		options.onEnd?.(collected, reason);
		if (pending) {
			pending.resolve({ value: undefined as never, done: true });
			pending = null;
		}
	}

	const timer = setTimeout(() => end("timeout"), options.timeout);

	const collector = {
		filter: options.filter,
		handle(ctx: ComponentInteractionContext) {
			collected.push(ctx);

			if (pending) {
				pending.resolve({ value: ctx, done: false });
				pending = null;
			} else {
				buffer.push(ctx);
			}

			if (options.max !== undefined && collected.length >= options.max) {
				end("max");
			}
		},
	};

	store.register(collector);

	const iterator: ComponentCollector = {
		stop() {
			end("manual");
		},

		next(): Promise<IteratorResult<ComponentInteractionContext>> {
			if (buffer.length > 0) {
				return Promise.resolve({ value: buffer.shift()!, done: false });
			}
			if (stopped) {
				return Promise.resolve({ value: undefined as never, done: true });
			}
			pending = deferred<IteratorResult<ComponentInteractionContext>>();
			return pending.promise;
		},

		return(): Promise<IteratorResult<ComponentInteractionContext>> {
			end("manual");
			return Promise.resolve({ value: undefined as never, done: true });
		},

		throw(e?: unknown): Promise<IteratorResult<ComponentInteractionContext>> {
			end("manual");
			return Promise.reject(e);
		},

		[Symbol.asyncIterator]() {
			return this;
		},
	};

	return iterator;
}
