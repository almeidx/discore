import type { ComponentInteractionContext } from "../components/context.ts";
import type { CollectorOptions, CollectorStore } from "./collector-store.ts";

type EndReason = "timeout" | "max" | "manual";

/** Options for `ctx.collectComponents()`. */
export interface CollectComponentsOptions extends CollectorOptions<ComponentInteractionContext> {
	max?: number;
	onEnd?: (collected: ComponentInteractionContext[], reason: EndReason) => void;
}

/** Async iterator that yields component interactions. Call {@link stop} to end collection early. */
export interface ComponentCollector extends AsyncIterableIterator<ComponentInteractionContext> {
	stop(): void;
}

type Result = IteratorResult<ComponentInteractionContext>;

export function collectComponents(
	store: CollectorStore<ComponentInteractionContext>,
	options: CollectComponentsOptions,
): ComponentCollector {
	const collected: ComponentInteractionContext[] = [];
	const buffer: ComponentInteractionContext[] = [];
	const waiting: ((result: Result) => void)[] = [];
	let stopped = false;

	function end(reason: EndReason): void {
		if (stopped) return;
		stopped = true;
		clearTimeout(timer);
		store.unregister(collector);
		options.onEnd?.(collected, reason);
		for (const resolve of waiting.splice(0)) {
			resolve({ value: undefined, done: true });
		}
	}

	const timer = setTimeout(() => end("timeout"), options.timeout);

	const collector = {
		filter: options.filter,
		handle(ctx: ComponentInteractionContext) {
			collected.push(ctx);

			const resolve = waiting.shift();
			if (resolve) {
				resolve({ value: ctx, done: false });
			} else {
				buffer.push(ctx);
			}

			if (options.max !== undefined && collected.length >= options.max) {
				end("max");
			}
		},
	};

	store.register(collector);

	return {
		stop() {
			end("manual");
		},

		next(): Promise<Result> {
			if (buffer.length > 0) {
				return Promise.resolve({ value: buffer.shift()!, done: false });
			}
			if (stopped) {
				return Promise.resolve({ value: undefined, done: true });
			}
			const { promise, resolve } = Promise.withResolvers<Result>();
			waiting.push(resolve);
			return promise;
		},

		return(): Promise<Result> {
			end("manual");
			return Promise.resolve({ value: undefined, done: true });
		},

		throw(e?: unknown): Promise<Result> {
			end("manual");
			return Promise.reject(e);
		},

		[Symbol.asyncIterator]() {
			return this;
		},
	};
}
