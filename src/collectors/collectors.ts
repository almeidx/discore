import type { ComponentInteractionContext } from "../components/context.ts";
import type { ModalContext } from "../components/modal.ts";
import { collectComponents, type CollectComponentsOptions, type ComponentCollector } from "./collect-components.ts";
import { createCollectorStore, type CollectorOptions, type CollectorStore } from "./collector-store.ts";
import { CollectorTimeoutError } from "./errors.ts";

/** Options for {@link CollectorMethods.awaitComponent}. */
export type AwaitComponentOptions = CollectorOptions<ComponentInteractionContext>;

/** Options for {@link CollectorMethods.awaitModal}. */
export type AwaitModalOptions = CollectorOptions<ModalContext>;

/** Collector methods available on command contexts. Collectors receive matching interactions before persistent handlers. */
export interface CollectorMethods {
	awaitComponent(options: AwaitComponentOptions): Promise<ComponentInteractionContext>;
	awaitModal(options: AwaitModalOptions): Promise<ModalContext>;
	collectComponents(options: CollectComponentsOptions): ComponentCollector;
}

export interface Collectors {
	components: CollectorStore<ComponentInteractionContext>;
	modals: CollectorStore<ModalContext>;
}

export function createCollectors(): Collectors {
	return { components: createCollectorStore(), modals: createCollectorStore() };
}

export function createCollectorMethods(collectors: Collectors): CollectorMethods {
	return {
		awaitComponent: (options) => awaitOne(collectors.components, options),
		awaitModal: (options) => awaitOne(collectors.modals, options),
		collectComponents: (options) => collectComponents(collectors.components, options),
	};
}

function awaitOne<T>(store: CollectorStore<T>, options: CollectorOptions<T>): Promise<T> {
	const { promise, resolve, reject } = Promise.withResolvers<T>();

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
	return promise;
}
